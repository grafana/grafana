package iam

import (
	"context"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic/registry"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

// convertRolePermissionsToTuples converts role permissions (action/scope) to v1 TupleKey format
// using the shared zanzana.ConvertRolePermissionsToTuples utility and common.ToAuthzExtTupleKeys
func convertRolePermissionsToTuples(roleUID string, permissions []iamv0.CoreRolespecPermission) ([]*v1.TupleKey, error) {
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

	// Translate to Zanzana tuples
	openfgaTuples, err := zanzana.ConvertRolePermissionsToTuples(roleUID, rolePerms)
	if err != nil {
		return nil, err
	}

	// Convert directly to v1 tuples using common utility
	v1Tuples := common.ToAuthzExtTupleKeys(openfgaTuples)

	return v1Tuples, nil
}

// AfterRoleCreate is a post-create hook that writes the role permissions to Zanzana (openFGA)
// It handles both Role and CoreRole types
func (b *IdentityAccessManagementAPIBuilder) AfterRoleCreate(obj runtime.Object, _ *metav1.CreateOptions) {
	if b.zClient == nil {
		return
	}

	var rType string
	var rt *iamv0.CoreRole

	if coreRole, ok := obj.(*iamv0.CoreRole); ok {
		rt = coreRole.DeepCopy()
		rType = "coreRole"
	} else if regRole, ok := obj.(*iamv0.Role); ok {
		regRolePermissions := make([]iamv0.CoreRolespecPermission, len(regRole.Spec.Permissions))
		for i, p := range regRole.Spec.Permissions {
			regRolePermissions[i] = iamv0.CoreRolespecPermission(p)
		}
		rt = &iamv0.CoreRole{
			ObjectMeta: metav1.ObjectMeta{
				Name:      regRole.Name,
				Namespace: regRole.Namespace,
			},
			Spec: iamv0.CoreRoleSpec{
				Permissions: regRolePermissions,
			},
		}
		rType = "role"
	} else {
		// Not a supported role type
		return
	}

	wait := time.Now()
	b.zTickets <- true
	hooksWaitHistogram.WithLabelValues(rType, "create").Observe(time.Since(wait).Seconds())

	go func(role *iamv0.CoreRole, roleType string) {
		start := time.Now()
		status := "success"
		defer func() {
			<-b.zTickets
			hooksDurationHistogram.WithLabelValues(rType, "create", status).Observe(time.Since(start).Seconds())
			hooksOperationCounter.WithLabelValues(rType, "create", status).Inc()
		}()

		tuples, err := convertRolePermissionsToTuples(role.Name, role.Spec.Permissions)
		if err != nil {
			b.logger.Error("failed to convert role permissions to tuples",
				"namespace", role.Namespace,
				"roleUID", role.Name,
				"roleType", roleType,
				"err", err,
				"permissionsCnt", len(role.Spec.Permissions),
			)
			status = "failure"
			return
		}

		// Avoid writing if there are no valid tuples
		if len(tuples) == 0 {
			b.logger.Debug("no valid tuples to write for role",
				"namespace", role.Namespace,
				"roleUID", role.Name,
				"roleType", roleType,
				"permissionsCnt", len(role.Spec.Permissions),
			)
			status = "failure"
			return
		}

		b.logger.Debug("writing role permissions to zanzana",
			"namespace", role.Namespace,
			"roleUID", role.Name,
			"roleType", roleType,
			"tuplesCnt", len(tuples),
			"permissionsCnt", len(role.Spec.Permissions),
		)

		ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
		defer cancel()

		err = b.zClient.Write(ctx, &v1.WriteRequest{
			Namespace: role.Namespace,
			Writes: &v1.WriteRequestWrites{
				TupleKeys: tuples,
			},
		})
		if err != nil {
			b.logger.Error("failed to write role permissions to zanzana",
				"err", err,
				"namespace", role.Namespace,
				"roleUID", role.Name,
				"roleType", roleType,
				"tuplesCnt", len(tuples),
			)
			status = "failure"
			return
		}

		// Record successful tuple writes
		hooksTuplesCounter.WithLabelValues(rType, "create", "write").Add(float64(len(tuples)))
	}(rt.DeepCopy(), rType)
}

// AfterRoleDelete is a post-delete hook that removes the role permissions from Zanzana (openFGA)
// It handles both Role and CoreRole types
func (b *IdentityAccessManagementAPIBuilder) AfterRoleDelete(obj runtime.Object, _ *metav1.DeleteOptions) {
	if b.zClient == nil {
		return
	}

	var rType string
	var rt *iamv0.CoreRole

	// Try CoreRole first
	if coreRole, ok := obj.(*iamv0.CoreRole); ok {
		rt = coreRole.DeepCopy()
		rType = "coreRole"
	} else if regRole, ok := obj.(*iamv0.Role); ok {
		regRolePermissions := make([]iamv0.CoreRolespecPermission, len(regRole.Spec.Permissions))
		for i, p := range regRole.Spec.Permissions {
			regRolePermissions[i] = iamv0.CoreRolespecPermission(p)
		}
		rt = &iamv0.CoreRole{
			ObjectMeta: metav1.ObjectMeta{
				Name:      regRole.Name,
				Namespace: regRole.Namespace,
			},
			Spec: iamv0.CoreRoleSpec{
				Permissions: regRolePermissions,
			},
		}
		rType = "role"
	} else {
		// Not a supported role type
		return
	}

	wait := time.Now()
	b.zTickets <- true
	hooksWaitHistogram.WithLabelValues("role", "delete").Observe(time.Since(wait).Seconds()) // Record wait time

	go func(role *iamv0.CoreRole, roleType string) {
		defer func() {
			<-b.zTickets
		}()

		b.logger.Debug("deleting role permissions from zanzana",
			"namespace", role.Namespace,
			"roleUID", role.Name,
			"roleType", roleType,
			"permissionsCnt", len(role.Spec.Permissions),
		)

		tuples, err := convertRolePermissionsToTuples(role.Name, role.Spec.Permissions)
		if err != nil {
			b.logger.Error("failed to convert role permissions to tuples for deletion",
				"namespace", role.Namespace,
				"roleUID", role.Name,
				"roleType", roleType,
				"err", err,
				"permissionsCnt", len(role.Spec.Permissions),
			)
			return
		}

		// Avoid deleting if there are no valid tuples
		if len(tuples) == 0 {
			b.logger.Debug("no valid tuples to delete for role",
				"namespace", role.Namespace,
				"roleUID", role.Name,
				"roleType", roleType,
				"permissionsCnt", len(role.Spec.Permissions),
			)
			return
		}

		// Convert tuples to TupleKeyWithoutCondition for deletion
		deleteTuples := toTupleKeysWithoutCondition(tuples)

		b.logger.Debug("deleting role permissions from zanzana",
			"namespace", role.Namespace,
			"roleUID", role.Name,
			"roleType", roleType,
			"tuplesCnt", len(deleteTuples),
			"permissionsCnt", len(role.Spec.Permissions),
		)

		ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
		defer cancel()

		err = b.zClient.Write(ctx, &v1.WriteRequest{
			Namespace: role.Namespace,
			Deletes: &v1.WriteRequestDeletes{
				TupleKeys: deleteTuples,
			},
		})
		if err != nil {
			b.logger.Error("failed to delete role permissions from zanzana",
				"err", err,
				"namespace", role.Namespace,
				"roleUID", role.Name,
				"roleType", roleType,
				"tuplesCnt", len(deleteTuples),
			)
		}
	}(rt.DeepCopy(), rType)
}

// beginRoleUpdate is a pre-update hook that prepares zanzana updates
// It converts old and new permissions to tuples and performs the zanzana write after K8s update succeeds
// It handles both Role and CoreRole types
func (b *IdentityAccessManagementAPIBuilder) BeginRoleUpdate(ctx context.Context, obj, oldObj runtime.Object, options *metav1.UpdateOptions) (registry.FinishFunc, error) {
	if b.zClient == nil {
		return nil, nil
	}
	var oldRole, newRole *iamv0.CoreRole
	var roleType string

	if oldCoreRole, ok := oldObj.(*iamv0.CoreRole); ok { // Try CoreRole first
		oldRole = oldCoreRole.DeepCopy()
		newCoreRole, ok := obj.(*iamv0.CoreRole)
		if !ok {
			return nil, nil
		}
		newRole = newCoreRole.DeepCopy()
		roleType = "coreRole"
	} else if oldRegRole, ok := oldObj.(*iamv0.Role); ok { // Try Role
		oldRegRolePermissions := make([]iamv0.CoreRolespecPermission, len(oldRegRole.Spec.Permissions))
		for i, p := range oldRegRole.Spec.Permissions {
			oldRegRolePermissions[i] = iamv0.CoreRolespecPermission(p)
		}
		oldRole = &iamv0.CoreRole{
			ObjectMeta: metav1.ObjectMeta{
				Name:      oldRegRole.Name,
				Namespace: oldRegRole.Namespace,
			},
			Spec: iamv0.CoreRoleSpec{
				Permissions: oldRegRolePermissions,
			},
		}
		newRegRole, ok := obj.(*iamv0.Role)
		if !ok {
			return nil, nil
		}
		newRegRolePermissions := make([]iamv0.CoreRolespecPermission, len(newRegRole.Spec.Permissions))
		for i, p := range newRegRole.Spec.Permissions {
			newRegRolePermissions[i] = iamv0.CoreRolespecPermission(p)
		}
		newRole = &iamv0.CoreRole{
			ObjectMeta: metav1.ObjectMeta{
				Name:      newRegRole.Name,
				Namespace: newRegRole.Namespace,
			},
			Spec: iamv0.CoreRoleSpec{
				Permissions: newRegRolePermissions,
			},
		}
		roleType = "role"
	} else {
		// Not a supported role type
		return nil, nil
	}

	// Return a finish function that performs the zanzana write only on success
	return func(ctx context.Context, success bool) {
		if !success {
			// Update failed, don't write to zanzana
			return
		}

		// Grab a ticket to write to Zanzana
		wait := time.Now()
		b.zTickets <- true
		hooksWaitHistogram.WithLabelValues(roleType, "update").Observe(time.Since(wait).Seconds()) // Record wait time

		go func(old *iamv0.CoreRole, new *iamv0.CoreRole) {
			defer func() {
				<-b.zTickets
			}()
			roleUID, namespace := old.Name, old.Namespace
			oldPermissions, newPermissions := old.Spec.Permissions, new.Spec.Permissions

			// Convert old permissions to tuples for deletion
			var oldTuples []*v1.TupleKey
			if len(oldPermissions) > 0 {
				var err error
				oldTuples, err = convertRolePermissionsToTuples(roleUID, oldPermissions)
				if err != nil {
					b.logger.Error("failed to convert old role permissions to tuples",
						"namespace", namespace,
						"roleUID", roleUID,
						"roleType", roleType,
						"err", err,
					)
				}
			}

			// Convert new permissions to tuples for writing
			newTuples, err := convertRolePermissionsToTuples(roleUID, newPermissions)
			if err != nil {
				b.logger.Error("failed to convert new role permissions to tuples",
					"namespace", namespace,
					"roleUID", roleUID,
					"roleType", roleType,
					"err", err,
				)
				return
			}

			b.logger.Debug("updating role permissions in zanzana",
				"namespace", namespace,
				"roleUID", roleUID,
				"roleType", roleType,
				"oldPermissionsCnt", len(oldPermissions),
				"newPermissionsCnt", len(newPermissions),
			)

			ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
			defer cancel()

			// Prepare write request
			req := &v1.WriteRequest{
				Namespace: namespace,
			}

			// Add deletes for old tuples
			if len(oldTuples) > 0 {
				deleteTuples := toTupleKeysWithoutCondition(oldTuples)
				req.Deletes = &v1.WriteRequestDeletes{
					TupleKeys: deleteTuples,
				}
				b.logger.Debug("deleting existing role permissions from zanzana",
					"namespace", namespace,
					"roleUID", roleUID,
					"roleType", roleType,
					"tuplesCnt", len(deleteTuples),
				)
			}

			// Add writes for new tuples
			if len(newTuples) > 0 {
				req.Writes = &v1.WriteRequestWrites{
					TupleKeys: newTuples,
				}
				b.logger.Debug("writing new role permissions to zanzana",
					"namespace", namespace,
					"roleUID", roleUID,
					"roleType", roleType,
					"tuplesCnt", len(newTuples),
				)
			}

			// Only make the request if there are deletes or writes
			if req.Deletes != nil || req.Writes != nil {
				err = b.zClient.Write(ctx, req)
				if err != nil {
					b.logger.Error("failed to update role permissions in zanzana",
						"err", err,
						"namespace", namespace,
						"roleUID", roleUID,
						"roleType", roleType,
					)
				}
			}
		}(oldRole.DeepCopy(), newRole.DeepCopy())
	}, nil
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
