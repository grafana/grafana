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
		return zanzana.NewTupleEntry(zanzana.TypeTeam, name, ""), nil
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

// AfterResourcePermissionUpdate is a post-update hook that updates the resource permission in Zanzana (openFGA)
// It uses a query-then-replace approach: query existing tuples, delete all, then write new ones
// This can be optimized by using BeforeResourcePermissionUpdate hook, which has access to the old and new permissions
// and can directly write the new tuples without querying the existing ones
func (b *IdentityAccessManagementAPIBuilder) AfterResourcePermissionUpdate(obj runtime.Object, _ *metav1.UpdateOptions) {
	if b.zClient == nil {
		return
	}

	rp, ok := obj.(*iamv0.ResourcePermission)
	if !ok {
		b.logger.Error("failed to convert object to resourcePermission type", "object", obj)
		return
	}

	resourceType := "resourcepermission"
	operation := "update"

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
		object := zanzana.NewObjectEntry(toZanzanaType(resource.ApiGroup), resource.ApiGroup, resource.Resource, "", resource.Name)

		// Query Zanzana to get all existing tuples for this resource object
		readCtx, readCancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
		defer readCancel()

		readResp, err := b.zClient.Read(readCtx, &v1.ReadRequest{
			Namespace: rp.Namespace,
			TupleKey: &v1.ReadRequestTupleKey{
				Object: object,
			},
		})

		var deleteTuples []*v1.TupleKeyWithoutCondition
		if err != nil {
			b.logger.Error("failed to read existing tuples from zanzana",
				"err", err,
				"namespace", rp.Namespace,
				"object", object,
			)
			// Continue anyway - we'll just write new tuples without deleting old ones
			// An operator will handle deletion of the old tuples
		} else if readResp != nil && len(readResp.Tuples) > 0 {
			// Convert existing tuples to TupleKeyWithoutCondition for deletion
			deleteTuples = make([]*v1.TupleKeyWithoutCondition, 0, len(readResp.Tuples))
			for _, existingTuple := range readResp.Tuples {
				deleteTuples = append(deleteTuples, &v1.TupleKeyWithoutCondition{
					User:     existingTuple.Key.User,
					Relation: existingTuple.Key.Relation,
					Object:   existingTuple.Key.Object,
				})
			}
		}

		// Generate write tuples from new permissions
		writeTuples := make([]*v1.TupleKey, 0, len(rp.Spec.Permissions))
		for _, p := range rp.Spec.Permissions {
			tuple, err := NewResourceTuple(object, resource, p)
			if err != nil {
				b.logger.Error("failed to create resource permission tuple",
					"namespace", rp.Namespace,
					"object", object,
					"err", err,
				)
				continue
			}
			writeTuples = append(writeTuples, tuple)
		}

		// If nothing to delete or write, skip
		if len(deleteTuples) == 0 && len(writeTuples) == 0 {
			b.logger.Debug("no tuples to update", "namespace", rp.Namespace, "resource", object)
			return
		}

		b.logger.Debug("updating resource permission in zanzana",
			"namespace", rp.Namespace,
			"object", object,
			"deleteCnt", len(deleteTuples),
			"writeCnt", len(writeTuples),
		)

		writeCtx, writeCancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
		defer writeCancel()

		// Create write request with both deletes and writes
		req := &v1.WriteRequest{
			Namespace: rp.Namespace,
		}

		if len(deleteTuples) > 0 {
			req.Deletes = &v1.WriteRequestDeletes{
				TupleKeys: deleteTuples,
			}
		}

		if len(writeTuples) > 0 {
			req.Writes = &v1.WriteRequestWrites{
				TupleKeys: writeTuples,
			}
		}

		err = b.zClient.Write(writeCtx, req)
		if err != nil {
			status = "failure"
			b.logger.Error("failed to update resource permission in zanzana",
				"err", err,
				"namespace", rp.Namespace,
				"object", object,
				"deleteCnt", len(deleteTuples),
				"writeCnt", len(writeTuples),
			)
		} else {
			// Record successful tuple operations
			if len(deleteTuples) > 0 {
				hooksTuplesCounter.WithLabelValues(resourceType, operation, "delete").Add(float64(len(deleteTuples)))
			}
			if len(writeTuples) > 0 {
				hooksTuplesCounter.WithLabelValues(resourceType, operation, "write").Add(float64(len(writeTuples)))
			}
		}
	}(rp.DeepCopy()) // Pass a copy of the object
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
