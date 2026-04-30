package iam

import (
	"context"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic/registry"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

// AfterServiceAccountCreate is a post-create hook that writes the service account's basic role assignment to Zanzana (openFGA)
func (b *IdentityAccessManagementAPIBuilder) AfterServiceAccountCreate(obj runtime.Object, _ *metav1.CreateOptions) {
	if b.zClient == nil {
		return
	}

	sa, ok := obj.(*iamv0.ServiceAccount)
	if !ok {
		b.logger.Error("failed to convert object to ServiceAccount type", "object", obj)
		return
	}

	// Skip if service account has no role assigned or role is None
	if sa.Spec.Role == "" || sa.Spec.Role == iamv0.ServiceAccountOrgRoleNone {
		b.logger.Debug("service account has no role assigned, skipping basic role sync",
			"namespace", sa.Namespace,
			"name", sa.Name,
		)
		return
	}

	resourceType := "service_account"
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

		b.logger.Debug("writing service account basic role to zanzana",
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
					Operation: &v1.MutateOperation_UpdateServiceAccountOrgRole{
						UpdateServiceAccountOrgRole: &v1.UpdateServiceAccountOrgRoleOperation{ServiceAccount: subjectName, Role: role},
					},
				},
			},
		})

		if err != nil {
			status = "failure"
			b.logger.Error("failed to write service account basic role to zanzana",
				"err", err,
				"namespace", namespace,
				"name", subjectName,
				"role", role,
			)
		} else {
			HooksTuplesCounter.WithLabelValues(resourceType, operation, "write").Inc()
		}
	}(sa.Namespace, sa.Name, string(sa.Spec.Role), resourceType, operation)
}

// BeginServiceAccountUpdate is a pre-update hook that gets called on service account updates
// It compares old and new roles and performs the zanzana write after K8s update succeeds
func (b *IdentityAccessManagementAPIBuilder) BeginServiceAccountUpdate(ctx context.Context, obj, oldObj runtime.Object, options *metav1.UpdateOptions) (registry.FinishFunc, error) {
	if b.zClient == nil {
		return nil, nil
	}

	oldSA, ok := oldObj.(*iamv0.ServiceAccount)
	if !ok {
		return nil, nil
	}

	newSA, ok := obj.(*iamv0.ServiceAccount)
	if !ok {
		return nil, nil
	}

	// If role hasn't changed, no need to update
	if oldSA.Spec.Role == newSA.Spec.Role {
		return nil, nil
	}

	resourceType := "service_account"
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

			b.logger.Debug("updating service account basic role in zanzana",
				"namespace", namespace,
				"name", subjectName,
				"oldRole", oldRole,
				"newRole", newRole,
			)

			ctx, cancel := context.WithTimeout(context.Background(), DefaultWriteTimeout)
			defer cancel()

			var operations []*v1.MutateOperation
			if newRole == "" || newRole == string(iamv0.ServiceAccountOrgRoleNone) {
				operations = []*v1.MutateOperation{
					{
						Operation: &v1.MutateOperation_DeleteServiceAccountOrgRole{
							DeleteServiceAccountOrgRole: &v1.DeleteServiceAccountOrgRoleOperation{ServiceAccount: subjectName, Role: oldRole},
						},
					},
				}
			} else {
				operations = []*v1.MutateOperation{
					{
						Operation: &v1.MutateOperation_UpdateServiceAccountOrgRole{
							UpdateServiceAccountOrgRole: &v1.UpdateServiceAccountOrgRoleOperation{ServiceAccount: subjectName, Role: newRole},
						},
					}, {
						Operation: &v1.MutateOperation_DeleteServiceAccountOrgRole{
							DeleteServiceAccountOrgRole: &v1.DeleteServiceAccountOrgRoleOperation{ServiceAccount: subjectName, Role: oldRole},
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
				b.logger.Error("failed to update service account basic role in zanzana",
					"err", err,
					"namespace", namespace,
					"name", subjectName,
					"role", newRole,
					"oldRole", oldRole,
				)
			}
		}(oldSA.Namespace, oldSA.Name, string(oldSA.Spec.Role), string(newSA.Spec.Role))
	}, nil
}

// AfterServiceAccountDelete is a post-delete hook that removes the service account's basic role assignment from Zanzana (openFGA)
func (b *IdentityAccessManagementAPIBuilder) AfterServiceAccountDelete(obj runtime.Object, _ *metav1.DeleteOptions) {
	if b.zClient == nil {
		return
	}

	sa, ok := obj.(*iamv0.ServiceAccount)
	if !ok {
		b.logger.Error("failed to convert object to ServiceAccount type", "object", obj)
		return
	}

	resourceType := "service_account"
	operation := "delete"

	// Skip if service account had no role assigned or role is None
	if sa.Spec.Role == "" || sa.Spec.Role == iamv0.ServiceAccountOrgRoleNone {
		b.logger.Debug("service account had no role assigned, skipping basic role sync",
			"namespace", sa.Namespace,
			"name", sa.Name,
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

		b.logger.Debug("deleting service account basic role from zanzana",
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
					Operation: &v1.MutateOperation_DeleteServiceAccountOrgRole{
						DeleteServiceAccountOrgRole: &v1.DeleteServiceAccountOrgRoleOperation{ServiceAccount: subjectName, Role: role},
					},
				},
			},
		})

		if err != nil {
			status = "failure"
			b.logger.Error("failed to delete service account basic role from zanzana",
				"err", err,
				"namespace", namespace,
				"name", subjectName,
				"role", role,
			)
		} else {
			HooksTuplesCounter.WithLabelValues(resourceType, operation, "delete").Inc()
		}
	}(sa.Namespace, sa.Name, string(sa.Spec.Role))
}
