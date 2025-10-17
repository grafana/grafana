package iam

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/protobuf/types/known/structpb"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
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

// AfterResourcePermissionCreate is a post-create hook that writes the resource permission to Zanzana (openFGA)
func (b *IdentityAccessManagementAPIBuilder) AfterResourcePermissionCreate(obj runtime.Object, _ *metav1.CreateOptions) {
	if b.zClient == nil {
		return
	}

	// Grab a ticket to write to Zanzana
	// This limits the amount of concurrent writes to Zanzana
	wait := time.Now()
	b.zTickets <- true
	hooksWaitHistogram.Observe(time.Since(wait).Seconds()) // Record wait time

	rp, ok := obj.(*iamv0.ResourcePermission)
	if !ok {
		return
	}

	go func(rp *iamv0.ResourcePermission) {
		defer func() {
			// Release the ticket after write is done
			<-b.zTickets
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
			b.logger.Error("failed to write resource permission to zanzana",
				"err", err,
				"namespace", rp.Namespace,
				"object", object,
				"tuplesCnt", len(tuples),
			)
		}
	}(rp.DeepCopy()) // Pass a copy of the object
}

// convertRolePermissionsToTuples converts role permissions (action/scope) to Zanzana tuples
// using the shared zanzana.ConvertRolePermissionsToTuples utility
func convertRolePermissionsToTuples(roleUID string, permissions []iamv0.CoreRolespecPermission) ([]*openfgav1.TupleKey, error) {
	// Convert IAM permissions to zanzana.RolePermission format
	rolePerms := make([]zanzana.RolePermission, 0, len(permissions))
	for _, perm := range permissions {
		// Split the scope to get kind, attribute, identifier
		kind, _, identifier := accesscontrol.SplitScope(perm.Scope)
		rolePerms = append(rolePerms, zanzana.RolePermission{
			Action:     perm.Action,
			Kind:       kind,
			Identifier: identifier,
		})
	}

	return zanzana.ConvertRolePermissionsToTuples(roleUID, rolePerms)
}

// AfterCoreRoleCreate is a post-create hook that writes the core role permissions to Zanzana (openFGA)
func (b *IdentityAccessManagementAPIBuilder) AfterCoreRoleCreate(obj runtime.Object, _ *metav1.CreateOptions) {
	if b.zClient == nil {
		return
	}

	role, ok := obj.(*iamv0.CoreRole)
	if !ok {
		return
	}

	roleUID := role.Name
	permissions := role.Spec.Permissions

	tuples, err := convertRolePermissionsToTuples(roleUID, permissions)
	if err != nil {
		b.logger.Error("failed to convert core role permissions to tuples",
			"namespace", role.Namespace,
			"roleUID", roleUID,
			"err", err,
		)
		return
	}

	// Avoid writing if there are no valid tuples
	if len(tuples) == 0 {
		b.logger.Debug("no valid tuples to write for core role", "namespace", role.Namespace, "roleUID", roleUID)
		return
	}

	b.logger.Debug("writing core role permissions to zanzana",
		"namespace", role.Namespace,
		"roleUID", roleUID,
		"tuplesCnt", len(tuples),
	)

	ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
	defer cancel()

	err = b.zClient.Write(ctx, &v1.WriteRequest{
		Namespace: role.Namespace,
		Writes: &v1.WriteRequestWrites{
			TupleKeys: convertOpenfgaTuplesToV1(tuples),
		},
	})
	if err != nil {
		b.logger.Error("failed to write core role permissions to zanzana",
			"err", err,
			"namespace", role.Namespace,
			"roleUID", roleUID,
			"tuplesCnt", len(tuples),
		)
	}
}

// AfterRoleCreate is a post-create hook that writes the role permissions to Zanzana (openFGA)
func (b *IdentityAccessManagementAPIBuilder) AfterRoleCreate(obj runtime.Object, _ *metav1.CreateOptions) {
	if b.zClient == nil {
		return
	}

	role, ok := obj.(*iamv0.Role)
	if !ok {
		return
	}

	roleUID := role.Name
	// Convert RolespecPermission to CoreRolespecPermission for the helper function
	corePermissions := make([]iamv0.CoreRolespecPermission, len(role.Spec.Permissions))
	for i, p := range role.Spec.Permissions {
		corePermissions[i] = iamv0.CoreRolespecPermission{
			Action: p.Action,
			Scope:  p.Scope,
		}
	}

	tuples, err := convertRolePermissionsToTuples(roleUID, corePermissions)
	if err != nil {
		b.logger.Error("failed to convert role permissions to tuples",
			"namespace", role.Namespace,
			"roleUID", roleUID,
			"err", err,
		)
		return
	}

	// Avoid writing if there are no valid tuples
	if len(tuples) == 0 {
		b.logger.Debug("no valid tuples to write for role", "namespace", role.Namespace, "roleUID", roleUID)
		return
	}

	b.logger.Debug("writing role permissions to zanzana",
		"namespace", role.Namespace,
		"roleUID", roleUID,
		"tuplesCnt", len(tuples),
	)

	ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
	defer cancel()

	err = b.zClient.Write(ctx, &v1.WriteRequest{
		Namespace: role.Namespace,
		Writes: &v1.WriteRequestWrites{
			TupleKeys: convertOpenfgaTuplesToV1(tuples),
		},
	})
	if err != nil {
		b.logger.Error("failed to write role permissions to zanzana",
			"err", err,
			"namespace", role.Namespace,
			"roleUID", roleUID,
			"tuplesCnt", len(tuples),
		)
	}
}

// convertOpenfgaTuplesToV1 converts openfga tuples to v1 proto tuples
func convertOpenfgaTuplesToV1(tuples []*openfgav1.TupleKey) []*v1.TupleKey {
	v1Tuples := make([]*v1.TupleKey, len(tuples))
	for i, t := range tuples {
		v1Tuples[i] = &v1.TupleKey{
			User:     t.User,
			Relation: t.Relation,
			Object:   t.Object,
		}
		if t.Condition != nil {
			v1Tuples[i].Condition = &v1.RelationshipCondition{
				Name:    t.Condition.Name,
				Context: t.Condition.Context,
			}
		}
	}
	return v1Tuples
}
