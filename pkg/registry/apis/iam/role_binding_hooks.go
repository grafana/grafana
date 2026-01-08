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

const resourceType = "rolebinding"

// AfterRoleBindingCreate is a post-create hook that writes the role binding to Zanzana (openFGA)
func (b *IdentityAccessManagementAPIBuilder) AfterRoleBindingCreate(obj runtime.Object, _ *metav1.CreateOptions) {
	if b.zClient == nil {
		return
	}

	rb, ok := obj.(*iamv0.RoleBinding)
	if !ok {
		b.logger.Error("failed to convert object to RoleBinding type", "object", obj)
		return
	}

	operation := "create"

	// Grab a ticket to write to Zanzana
	// This limits the amount of concurrent connections to Zanzana
	wait := time.Now()
	b.zTickets <- true
	hooksWaitHistogram.WithLabelValues(resourceType, operation).Observe(time.Since(wait).Seconds())

	go func(rb *iamv0.RoleBinding) {
		start := time.Now()
		status := "success"

		defer func() {
			// Release the ticket after write is done
			<-b.zTickets
			// Record operation duration and count
			hooksDurationHistogram.WithLabelValues(resourceType, operation, status).Observe(time.Since(start).Seconds())
		}()

		b.logger.Debug("writing role binding to zanzana",
			"namespace", rb.Namespace,
			"name", rb.Name,
			"subject", rb.Spec.Subject.Name,
			"roleRefs", rb.Spec.RoleRefs,
		)

		ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
		defer cancel()

		operations := make([]*v1.MutateOperation, 0, len(rb.Spec.RoleRefs))
		for _, roleRef := range rb.Spec.RoleRefs {
			operations = append(operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_CreateRoleBinding{
					CreateRoleBinding: &v1.CreateRoleBindingOperation{
						SubjectKind: string(rb.Spec.Subject.Kind),
						SubjectName: rb.Spec.Subject.Name,
						RoleKind:    string(roleRef.Kind),
						RoleName:    roleRef.Name,
					},
				},
			})
		}

		if len(operations) == 0 {
			return
		}

		err := b.zClient.Mutate(ctx, &v1.MutateRequest{
			Namespace:  rb.Namespace,
			Operations: operations,
		})

		if err != nil {
			status = "failure"
			b.logger.Error("failed to write role binding to zanzana",
				"err", err,
				"namespace", rb.Namespace,
				"name", rb.Name,
				"subject", rb.Spec.Subject.Name,
				"roleRefs", rb.Spec.RoleRefs,
			)
		}
	}(rb.DeepCopy()) // Pass a copy of the object
}

// AfterRoleBindingDelete is a post-delete hook that removes the role binding from Zanzana (openFGA)
func (b *IdentityAccessManagementAPIBuilder) AfterRoleBindingDelete(obj runtime.Object, _ *metav1.DeleteOptions) {
	if b.zClient == nil {
		return
	}

	rb, ok := obj.(*iamv0.RoleBinding)
	if !ok {
		b.logger.Error("failed to convert object to RoleBinding type", "object", obj)
		return
	}

	operation := "delete"

	// Grab a ticket to write to Zanzana
	// This limits the amount of concurrent connections to Zanzana
	wait := time.Now()
	b.zTickets <- true
	hooksWaitHistogram.WithLabelValues(resourceType, operation).Observe(time.Since(wait).Seconds())

	go func(rb *iamv0.RoleBinding) {
		start := time.Now()
		status := "success"

		defer func() {
			// Release the ticket after write is done
			<-b.zTickets
			// Record operation duration and count
			hooksDurationHistogram.WithLabelValues(resourceType, operation, status).Observe(time.Since(start).Seconds())
		}()

		b.logger.Debug("deleting role binding from zanzana",
			"namespace", rb.Namespace,
			"name", rb.Name,
			"subject", rb.Spec.Subject.Name,
			"roleRefs", rb.Spec.RoleRefs,
		)

		ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
		defer cancel()

		operations := make([]*v1.MutateOperation, 0, len(rb.Spec.RoleRefs))
		for _, roleRef := range rb.Spec.RoleRefs {
			operations = append(operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_DeleteRoleBinding{
					DeleteRoleBinding: &v1.DeleteRoleBindingOperation{
						SubjectKind: string(rb.Spec.Subject.Kind),
						SubjectName: rb.Spec.Subject.Name,
						RoleKind:    string(roleRef.Kind),
						RoleName:    roleRef.Name,
					},
				},
			})
		}

		if len(operations) == 0 {
			return
		}

		err := b.zClient.Mutate(ctx, &v1.MutateRequest{
			Namespace:  rb.Namespace,
			Operations: operations,
		})

		if err != nil {
			status = "failure"
			b.logger.Error("failed to delete role binding from zanzana",
				"err", err,
				"namespace", rb.Namespace,
				"name", rb.Name,
				"subject", rb.Spec.Subject.Name,
				"roleRefs", rb.Spec.RoleRefs,
			)
		}
	}(rb.DeepCopy()) // Pass a copy of the object
}

// BeginRoleBindingUpdate is a pre-update hook that prepares zanzana updates.
// It performs the zanzana write after K8s update succeeds.
func (b *IdentityAccessManagementAPIBuilder) BeginRoleBindingUpdate(ctx context.Context, obj, oldObj runtime.Object, options *metav1.UpdateOptions) (registry.FinishFunc, error) {
	if b.zClient == nil {
		return nil, nil
	}

	// Extract role bindings from both old and new objects
	oldRB, ok := oldObj.(*iamv0.RoleBinding)
	if !ok {
		return nil, nil
	}

	newRB, ok := obj.(*iamv0.RoleBinding)
	if !ok {
		return nil, nil
	}

	if oldRB.Spec.Subject.Name == newRB.Spec.Subject.Name && roleRefsEqual(oldRB.Spec.RoleRefs, newRB.Spec.RoleRefs) {
		return nil, nil // No changes to the role binding
	}

	if newRB.Spec.Subject.Name == "" {
		b.logger.Error("invalid role binding",
			"namespace", newRB.Namespace,
			"name", newRB.Name,
			"subject", newRB.Spec.Subject.Name,
			"roleRefs", newRB.Spec.RoleRefs,
		)
		return nil, nil
	}

	// Return a finish function that performs the zanzana write only on success
	return func(ctx context.Context, success bool) {
		if !success {
			return
		}

		wait := time.Now()
		b.zTickets <- true
		hooksWaitHistogram.WithLabelValues(resourceType, "update").Observe(time.Since(wait).Seconds())

		go func() {
			start := time.Now()
			status := "success"

			defer func() {
				<-b.zTickets
				// Record operation duration and count
				hooksDurationHistogram.WithLabelValues(resourceType, "update", status).Observe(time.Since(start).Seconds())
			}()

			b.logger.Debug("updating role binding in zanzana",
				"namespace", newRB.Namespace,
				"name", newRB.Name,
				"oldSubject", oldRB.Spec.Subject.Name,
				"newSubject", newRB.Spec.Subject.Name,
				"oldRoleRefs", oldRB.Spec.RoleRefs,
				"newRoleRefs", newRB.Spec.RoleRefs,
			)

			ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
			defer cancel()

			operations := make([]*v1.MutateOperation, 0, len(oldRB.Spec.RoleRefs))
			for _, roleRef := range oldRB.Spec.RoleRefs {
				operations = append(operations, &v1.MutateOperation{
					Operation: &v1.MutateOperation_DeleteRoleBinding{
						DeleteRoleBinding: &v1.DeleteRoleBindingOperation{
							SubjectKind: string(oldRB.Spec.Subject.Kind),
							SubjectName: oldRB.Spec.Subject.Name,
							RoleKind:    string(roleRef.Kind),
							RoleName:    roleRef.Name,
						},
					},
				})
			}
			for _, roleRef := range newRB.Spec.RoleRefs {
				operations = append(operations, &v1.MutateOperation{
					Operation: &v1.MutateOperation_CreateRoleBinding{
						CreateRoleBinding: &v1.CreateRoleBindingOperation{
							SubjectKind: string(newRB.Spec.Subject.Kind),
							SubjectName: newRB.Spec.Subject.Name,
							RoleKind:    string(roleRef.Kind),
							RoleName:    roleRef.Name,
						},
					},
				})
			}

			// Only make the request if there are deletes or writes
			if len(operations) == 0 {
				b.logger.Debug("no role bindings to update in zanzana", "namespace", newRB.Namespace, "name", newRB.Name)
				return
			}

			err := b.zClient.Mutate(ctx, &v1.MutateRequest{
				Namespace:  newRB.Namespace,
				Operations: operations,
			})
			if err != nil {
				status = "failure"
				b.logger.Error("failed to update role binding in zanzana",
					"err", err,
					"namespace", newRB.Namespace,
					"name", newRB.Name,
				)
			}
		}()
	}, nil
}

func roleRefsEqual(oldRoleRefs, newRoleRefs []iamv0.RoleBindingspecRoleRef) bool {
	if len(oldRoleRefs) != len(newRoleRefs) {
		return false
	}

	oldRoleRefsMap := make(map[string]string)
	for _, roleRef := range oldRoleRefs {
		oldRoleRefsMap[roleRef.Name] = string(roleRef.Kind)
	}
	for _, roleRef := range newRoleRefs {
		refKind, ok := oldRoleRefsMap[roleRef.Name]
		if !ok {
			return false
		}
		if refKind != string(roleRef.Kind) {
			return false
		}
	}
	return true
}
