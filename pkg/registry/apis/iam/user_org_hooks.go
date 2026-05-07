package iam

import (
	"context"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic/registry"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

// AfterUserCreate is a post-create hook that writes the user's basic role assignment to Zanzana (openFGA)
func (b *IdentityAccessManagementAPIBuilder) AfterUserCreate(obj runtime.Object, _ *metav1.CreateOptions) {
	if b.zClient == nil {
		return
	}

	user, ok := obj.(*iamv0.User)
	if !ok {
		b.logger.Error("failed to convert object to User type", "object", obj)
		return
	}

	// Skip if user has no role assigned or role is None
	if user.Spec.Role == "" || user.Spec.Role == string(identity.RoleNone) {
		b.logger.Debug("user has no role assigned, skipping basic role sync",
			"namespace", user.Namespace,
			"name", user.Name,
		)
		return
	}

	resourceType := "user"
	operation := "create"

	// Grab a ticket to write to Zanzana
	wait := time.Now()
	b.zTickets <- true
	HooksWaitHistogram.WithLabelValues(resourceType, operation).Observe(time.Since(wait).Seconds())

	go func(namespace, subjectName, role, resourceType, operation string) {
		start := time.Now()
		status := "success"

		defer func() {
			<-b.zTickets
			HooksDurationHistogram.WithLabelValues(resourceType, operation, status).Observe(time.Since(start).Seconds())
			HooksOperationCounter.WithLabelValues(resourceType, operation, status).Inc()
		}()

		b.logger.Debug("writing user basic role to zanzana",
			"namespace", namespace,
			"name", subjectName,
			"role", role,
		)

		ctx, cancel := context.WithTimeout(context.Background(), DefaultWriteTimeout)
		defer cancel()

		err := b.zClient.Mutate(ctx, &v1.MutateRequest{
			Namespace: namespace,
			Operations: []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_UpdateUserOrgRole{
						UpdateUserOrgRole: &v1.UpdateUserOrgRoleOperation{User: subjectName, Role: role},
					},
				},
			},
		})

		if err != nil {
			status = "failure"
			b.logger.Error("failed to write user basic role to zanzana",
				"err", err,
				"namespace", namespace,
				"name", subjectName,
				"role", role,
			)
		} else {
			HooksTuplesCounter.WithLabelValues(resourceType, operation, "write").Inc()
		}
	}(user.Namespace, user.Name, user.Spec.Role, resourceType, operation)
}

// BeginUserUpdate is a pre-update hook that gets called on user updates
// It compares old and new roles and performs the zanzana write after K8s update succeeds
func (b *IdentityAccessManagementAPIBuilder) BeginUserUpdate(ctx context.Context, obj, oldObj runtime.Object, options *metav1.UpdateOptions) (registry.FinishFunc, error) {
	if b.zClient == nil {
		return nil, nil
	}

	oldUser, ok := oldObj.(*iamv0.User)
	if !ok {
		return nil, nil
	}

	newUser, ok := obj.(*iamv0.User)
	if !ok {
		return nil, nil
	}

	// If role hasn't changed, no need to update
	if oldUser.Spec.Role == newUser.Spec.Role {
		return nil, nil
	}

	resourceType := "user"
	operation := "update"

	// Return a finish function that performs the zanzana write only on success
	return func(ctx context.Context, success bool) {
		if !success {
			return
		}

		wait := time.Now()
		b.zTickets <- true
		HooksWaitHistogram.WithLabelValues(resourceType, operation).Observe(time.Since(wait).Seconds())

		go func(namespace, subjectName, oldRole, newRole string) {
			start := time.Now()
			status := "success"

			defer func() {
				<-b.zTickets
				HooksDurationHistogram.WithLabelValues(resourceType, operation, status).Observe(time.Since(start).Seconds())
				HooksOperationCounter.WithLabelValues(resourceType, operation, status).Inc()
			}()

			b.logger.Debug("updating user basic role in zanzana",
				"namespace", namespace,
				"name", subjectName,
				"oldRole", oldRole,
				"newRole", newRole,
			)

			ctx, cancel := context.WithTimeout(context.Background(), DefaultWriteTimeout)
			defer cancel()

			var operations []*v1.MutateOperation
			if newRole == "" || newRole == string(identity.RoleNone) {
				operations = []*v1.MutateOperation{
					{
						Operation: &v1.MutateOperation_DeleteUserOrgRole{
							DeleteUserOrgRole: &v1.DeleteUserOrgRoleOperation{User: subjectName, Role: oldRole},
						},
					},
				}
			} else {
				operations = []*v1.MutateOperation{
					{
						Operation: &v1.MutateOperation_UpdateUserOrgRole{
							UpdateUserOrgRole: &v1.UpdateUserOrgRoleOperation{User: subjectName, Role: newRole},
						},
					}, {
						Operation: &v1.MutateOperation_DeleteUserOrgRole{
							DeleteUserOrgRole: &v1.DeleteUserOrgRoleOperation{User: subjectName, Role: oldRole},
						},
					},
				}
			}

			err := b.zClient.Mutate(ctx, &v1.MutateRequest{
				Namespace:  namespace,
				Operations: operations,
			})
			if err != nil {
				status = "failure"
				b.logger.Error("failed to update user basic role in zanzana",
					"err", err,
					"namespace", namespace,
					"name", subjectName,
					"role", newRole,
					"oldRole", oldRole,
				)
			}
		}(oldUser.Namespace, oldUser.Name, oldUser.Spec.Role, newUser.Spec.Role)
	}, nil
}

// AfterUserDelete is a post-delete hook that removes the user's basic role assignment from Zanzana (openFGA)
func (b *IdentityAccessManagementAPIBuilder) AfterUserDelete(obj runtime.Object, _ *metav1.DeleteOptions) {
	if b.zClient == nil {
		return
	}

	user, ok := obj.(*iamv0.User)
	if !ok {
		b.logger.Error("failed to convert object to User type", "object", obj)
		return
	}

	resourceType := "user"
	operation := "delete"

	// Skip if user had no role assigned or role is None
	if user.Spec.Role == "" || user.Spec.Role == string(identity.RoleNone) {
		b.logger.Debug("user had no role assigned, skipping basic role sync",
			"namespace", user.Namespace,
			"name", user.Name,
		)
		return
	}

	wait := time.Now()
	b.zTickets <- true
	HooksWaitHistogram.WithLabelValues(resourceType, operation).Observe(time.Since(wait).Seconds())

	go func(namespace, subjectName, role string) {
		start := time.Now()
		status := "success"

		defer func() {
			<-b.zTickets
			HooksDurationHistogram.WithLabelValues(resourceType, operation, status).Observe(time.Since(start).Seconds())
			HooksOperationCounter.WithLabelValues(resourceType, operation, status).Inc()
		}()

		b.logger.Debug("deleting user basic role from zanzana",
			"namespace", namespace,
			"name", subjectName,
			"role", role,
		)

		ctx, cancel := context.WithTimeout(context.Background(), DefaultWriteTimeout)
		defer cancel()

		err := b.zClient.Mutate(ctx, &v1.MutateRequest{
			Namespace: namespace,
			Operations: []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_DeleteUserOrgRole{
						DeleteUserOrgRole: &v1.DeleteUserOrgRoleOperation{User: subjectName, Role: role},
					},
				},
			},
		})

		if err != nil {
			status = "failure"
			b.logger.Error("failed to delete user basic role from zanzana",
				"err", err,
				"namespace", namespace,
				"name", subjectName,
				"role", role,
			)
		} else {
			HooksTuplesCounter.WithLabelValues(resourceType, operation, "delete").Inc()
		}
	}(user.Namespace, user.Name, user.Spec.Role)
}
