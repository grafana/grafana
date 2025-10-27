package iam

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"google.golang.org/protobuf/types/known/structpb"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic/registry"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

var (
	errEmptyName        = errors.New("name cannot be empty")
	errInvalidBasicRole = errors.New("invalid basic role")
	errUnknownKind      = errors.New("unknown permission kind")

	defaultWriteTimeout = 15 * time.Second
)

func toZanzanaSubject(kind iamv0.ResourcePermissionSpecPermissionKind, name string) (string, error) {
	if name == "" {
		return "", errEmptyName
	}
	switch kind {
	case iamv0.ResourcePermissionSpecPermissionKindUser:
		return zanzana.NewTupleEntry(zanzana.TypeUser, name, ""), nil
	case iamv0.ResourcePermissionSpecPermissionKindServiceAccount:
		return zanzana.NewTupleEntry(zanzana.TypeServiceAccount, name, ""), nil
	case iamv0.ResourcePermissionSpecPermissionKindTeam:
		return zanzana.NewTupleEntry(zanzana.TypeTeam, name, zanzana.RelationTeamMember), nil
	case iamv0.ResourcePermissionSpecPermissionKindBasicRole:
		basicRole := zanzana.TranslateBasicRole(name)
		if basicRole == "" {
			return "", fmt.Errorf("%w: %s", errInvalidBasicRole, name)
		}

		// e.g role:basic_viewer#assignee
		return zanzana.NewTupleEntry(zanzana.TypeRole, basicRole, zanzana.RelationAssignee), nil
	}

	// should not happen since we are after create
	// validation webhook should have caught invalid kinds
	return "", errUnknownKind
}

func toZanzanaType(apiGroup string) string {
	if apiGroup == "folder.grafana.app" {
		return zanzana.TypeFolder
	}
	return zanzana.TypeResource
}

func NewResourceTuple(object string, resource iamv0.ResourcePermissionspecResource, perm iamv0.ResourcePermissionspecPermission) (*v1.TupleKey, error) {
	// Typ is "folder" or "resource"
	typ := toZanzanaType(resource.ApiGroup)

	// subject
	subject, err := toZanzanaSubject(perm.Kind, perm.Name)
	if err != nil {
		return nil, err
	}

	key := &v1.TupleKey{
		// e.g. "user:{uid}", "serviceaccount:{uid}", "team:{uid}", "basicrole:{viewer|editor|admin}"
		User: subject,
		// "view", "edit", "admin"
		Relation: strings.ToLower(perm.Verb),
		// e.g. "folder:{name}" or "resource:{apiGroup}/{resource}/{name}"
		Object: object,
	}

	// For resources we add a condition to filter by apiGroup/resource
	// e.g "group_filter": {"group_resource": "dashboards.grafana.app/dashboards"}
	if typ == zanzana.TypeResource {
		key.Condition = &v1.RelationshipCondition{
			Name: "group_filter",
			Context: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"group_resource": structpb.NewStringValue(
						resource.ApiGroup + "/" + resource.Resource,
					),
				},
			},
		}
	}

	return key, nil
}

// tupleToTupleKeyWithoutCondition converts a TupleKey to TupleKeyWithoutCondition
// This is needed for delete operations which don't support conditions
func tupleToTupleKeyWithoutCondition(tuple *v1.TupleKey) *v1.TupleKeyWithoutCondition {
	return &v1.TupleKeyWithoutCondition{
		User:     tuple.User,
		Relation: tuple.Relation,
		Object:   tuple.Object,
	}
}

// toTupleKeysWithoutCondition converts v1.TupleKey to v1.TupleKeyWithoutCondition
// by stripping the condition field, which is required for delete operations
func toTupleKeysWithoutCondition(tuples []*v1.TupleKey) []*v1.TupleKeyWithoutCondition {
	result := make([]*v1.TupleKeyWithoutCondition, len(tuples))
	for i, t := range tuples {
		result[i] = tupleToTupleKeyWithoutCondition(t)
	}
	return result
}

// AfterResourcePermissionCreate is a post-create hook that writes the resource permission to Zanzana (openFGA)
func (b *IdentityAccessManagementAPIBuilder) AfterResourcePermissionCreate(obj runtime.Object, _ *metav1.CreateOptions) {
	if b.zClient == nil {
		return
	}

	rp, ok := obj.(*iamv0.ResourcePermission)
	if !ok {
		b.logger.Error("failed to convert object to resourcePermission type", "object", obj)
		return
	}

	resourceType := "resourcepermission"
	operation := "create"

	// Grab a ticket to write to Zanzana
	// This limits the amount of concurrent connections to Zanzana
	wait := time.Now()
	b.zTickets <- true
	hooksWaitHistogram.WithLabelValues(resourceType, operation).Observe(time.Since(wait).Seconds()) // Record wait time

	go func(rp *iamv0.ResourcePermission) {
		start := time.Now()
		status := "success"

		defer func() {
			// Release the ticket after write is done
			<-b.zTickets
			// Record operation duration and count
			hooksDurationHistogram.WithLabelValues(resourceType, operation, status).Observe(time.Since(start).Seconds())
			hooksOperationCounter.WithLabelValues(resourceType, operation, status).Inc()
		}()

		resource := rp.Spec.Resource
		permissions := rp.Spec.Permissions

		object := zanzana.NewObjectEntry(toZanzanaType(resource.ApiGroup), resource.ApiGroup, resource.Resource, "", resource.Name)

		tuples := make([]*v1.TupleKey, 0, len(permissions))
		for _, p := range permissions {
			tuple, err := NewResourceTuple(object, resource, p)
			if err != nil {
				b.logger.Error("failed to create resource permission tuple",
					"namespace", rp.Namespace,
					"object", object,
					"err", err,
				)

				continue
			}
			tuples = append(tuples, tuple)
		}

		// Avoid writing if there are no valid tuples
		if len(tuples) == 0 {
			b.logger.Warn("no valid tuples to write", "namespace", rp.Namespace, "resource", object)
			status = "failure"
			return
		}

		b.logger.Debug("writing resource permission to zanzana",
			"namespace", rp.Namespace,
			"object", object,
			"tuplesCnt", len(tuples),
		)

		ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
		defer cancel()

		err := b.zClient.Write(ctx, &v1.WriteRequest{
			Namespace: rp.Namespace,
			Writes: &v1.WriteRequestWrites{
				TupleKeys: tuples,
			},
		})
		if err != nil {
			status = "failure"
			b.logger.Error("failed to write resource permission to zanzana",
				"err", err,
				"namespace", rp.Namespace,
				"object", object,
				"tuplesCnt", len(tuples),
			)
		} else {
			// Record successful tuple writes
			hooksTuplesCounter.WithLabelValues(resourceType, operation, "write").Add(float64(len(tuples)))
		}
	}(rp.DeepCopy()) // Pass a copy of the object
}

// BeginResourcePermissionUpdate is a pre-update hook that prepares zanzana updates
// It converts old and new permissions to tuples and performs the zanzana write after K8s update succeeds
func (b *IdentityAccessManagementAPIBuilder) BeginResourcePermissionUpdate(ctx context.Context, obj, oldObj runtime.Object, options *metav1.UpdateOptions) (registry.FinishFunc, error) {
	if b.zClient == nil {
		return nil, nil
	}

	// Extract permissions from both old and new objects
	oldRP, ok := oldObj.(*iamv0.ResourcePermission)
	if !ok {
		return nil, nil
	}

	newRP, ok := obj.(*iamv0.ResourcePermission)
	if !ok {
		return nil, nil
	}

	// Convert old permissions to tuples for deletion
	var oldTuples []*v1.TupleKey
	if len(oldRP.Spec.Permissions) > 0 {
		oldResource := oldRP.Spec.Resource
		oldObject := zanzana.NewObjectEntry(toZanzanaType(oldResource.ApiGroup), oldResource.ApiGroup, oldResource.Resource, "", oldResource.Name)

		oldTuples = make([]*v1.TupleKey, 0, len(oldRP.Spec.Permissions))
		for _, p := range oldRP.Spec.Permissions {
			tuple, err := NewResourceTuple(oldObject, oldResource, p)
			if err != nil {
				b.logger.Error("failed to create old resource permission tuple",
					"namespace", oldRP.Namespace,
					"object", oldObject,
					"err", err,
				)
				continue
			}
			oldTuples = append(oldTuples, tuple)
		}
	}

	// Convert new permissions to tuples for writing
	var newTuples []*v1.TupleKey
	if len(newRP.Spec.Permissions) > 0 {
		newResource := newRP.Spec.Resource
		newObject := zanzana.NewObjectEntry(toZanzanaType(newResource.ApiGroup), newResource.ApiGroup, newResource.Resource, "", newResource.Name)

		newTuples = make([]*v1.TupleKey, 0, len(newRP.Spec.Permissions))
		for _, p := range newRP.Spec.Permissions {
			tuple, err := NewResourceTuple(newObject, newResource, p)
			if err != nil {
				b.logger.Error("failed to create new resource permission tuple",
					"namespace", newRP.Namespace,
					"object", newObject,
					"err", err,
				)
				continue
			}
			newTuples = append(newTuples, tuple)
		}
	}

	// Return a finish function that performs the zanzana write only on success
	return func(ctx context.Context, success bool) {
		if !success {
			// Update failed, don't write to zanzana
			return
		}

		// Grab a ticket to write to Zanzana
		// This limits the amount of concurrent connections to Zanzana
		wait := time.Now()
		b.zTickets <- true
		hooksWaitHistogram.WithLabelValues("resourcepermission", "update").Observe(time.Since(wait).Seconds())

		go func() {
			start := time.Now()
			status := "success"

			defer func() {
				<-b.zTickets
				// Record operation duration and count
				hooksDurationHistogram.WithLabelValues("resourcepermission", "update", status).Observe(time.Since(start).Seconds())
				hooksOperationCounter.WithLabelValues("resourcepermission", "update", status).Inc()
			}()

			b.logger.Debug("updating resource permission in zanzana",
				"namespace", newRP.Namespace,
				"oldPermissionsCnt", len(oldRP.Spec.Permissions),
				"newPermissionsCnt", len(newRP.Spec.Permissions),
			)

			ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
			defer cancel()

			// Prepare write request
			req := &v1.WriteRequest{
				Namespace: newRP.Namespace,
			}

			// Add deletes for old tuples
			if len(oldTuples) > 0 {
				deleteTuples := toTupleKeysWithoutCondition(oldTuples)
				req.Deletes = &v1.WriteRequestDeletes{
					TupleKeys: deleteTuples,
				}
				b.logger.Debug("deleting existing resource permissions from zanzana",
					"namespace", newRP.Namespace,
					"tuplesCnt", len(deleteTuples),
				)
			}

			// Add writes for new tuples
			if len(newTuples) > 0 {
				req.Writes = &v1.WriteRequestWrites{
					TupleKeys: newTuples,
				}
				b.logger.Debug("writing new resource permissions to zanzana",
					"namespace", newRP.Namespace,
					"tuplesCnt", len(newTuples),
				)
			}

			// Only make the request if there are deletes or writes
			if (req.Deletes != nil && len(req.Deletes.TupleKeys) > 0) || (req.Writes != nil && len(req.Writes.TupleKeys) > 0) {
				err := b.zClient.Write(ctx, req)
				if err != nil {
					status = "failure"
					b.logger.Error("failed to update resource permission in zanzana",
						"err", err,
						"namespace", newRP.Namespace,
					)
				} else {
					// Record successful tuple operations
					if len(oldTuples) > 0 {
						hooksTuplesCounter.WithLabelValues("resourcepermission", "update", "delete").Add(float64(len(oldTuples)))
					}
					if len(newTuples) > 0 {
						hooksTuplesCounter.WithLabelValues("resourcepermission", "update", "write").Add(float64(len(newTuples)))
					}
				}
			} else {
				b.logger.Debug("no tuples to update in zanzana", "namespace", newRP.Namespace)
			}
		}()
	}, nil
}

// AfterResourcePermissionDelete is a post-delete hook that removes the resource permission from Zanzana (openFGA)
func (b *IdentityAccessManagementAPIBuilder) AfterResourcePermissionDelete(obj runtime.Object, _ *metav1.DeleteOptions) {
	if b.zClient == nil {
		return
	}

	rp, ok := obj.(*iamv0.ResourcePermission)
	if !ok {
		b.logger.Error("failed to convert object to resourcePermission type", "object", obj)
		return
	}

	resourceType := "resourcepermission"
	operation := "delete"

	// Grab a ticket to write to Zanzana
	// This limits the amount of concurrent connections to Zanzana
	wait := time.Now()
	b.zTickets <- true
	hooksWaitHistogram.WithLabelValues(resourceType, operation).Observe(time.Since(wait).Seconds()) // Record wait time

	go func(rp *iamv0.ResourcePermission) {
		start := time.Now()
		status := "success"

		defer func() {
			// Release the ticket after write is done
			<-b.zTickets
			// Record operation duration and count
			hooksDurationHistogram.WithLabelValues(resourceType, operation, status).Observe(time.Since(start).Seconds())
			hooksOperationCounter.WithLabelValues(resourceType, operation, status).Inc()
		}()

		resource := rp.Spec.Resource
		permissions := rp.Spec.Permissions

		object := zanzana.NewObjectEntry(toZanzanaType(resource.ApiGroup), resource.ApiGroup, resource.Resource, "", resource.Name)

		// Generate delete tuples from the permissions
		deleteTuples := make([]*v1.TupleKeyWithoutCondition, 0, len(permissions))
		for _, p := range permissions {
			tuple, err := NewResourceTuple(object, resource, p)
			if err != nil {
				b.logger.Error("failed to create resource permission tuple for deletion",
					"namespace", rp.Namespace,
					"object", object,
					"err", err,
				)
				continue
			}
			deleteTuples = append(deleteTuples, tupleToTupleKeyWithoutCondition(tuple))
		}

		// Avoid writing if there are no valid tuples
		if len(deleteTuples) == 0 {
			b.logger.Warn("no valid tuples to delete", "namespace", rp.Namespace, "resource", object)
			status = "failure"
			return
		}

		b.logger.Debug("deleting resource permission from zanzana",
			"namespace", rp.Namespace,
			"object", object,
			"tuplesCnt", len(deleteTuples),
		)

		ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
		defer cancel()

		err := b.zClient.Write(ctx, &v1.WriteRequest{
			Namespace: rp.Namespace,
			Deletes: &v1.WriteRequestDeletes{
				TupleKeys: deleteTuples,
			},
		})
		if err != nil {
			status = "failure"
			b.logger.Error("failed to delete resource permission from zanzana",
				"err", err,
				"namespace", rp.Namespace,
				"object", object,
				"tuplesCnt", len(deleteTuples),
			)
		} else {
			// Record successful tuple deletions
			hooksTuplesCounter.WithLabelValues(resourceType, operation, "delete").Add(float64(len(deleteTuples)))
		}
	}(rp.DeepCopy()) // Pass a copy of the object
}
