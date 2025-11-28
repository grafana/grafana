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

// AfterTeamBindingCreate is a post-create hook that writes the team binding to Zanzana (openFGA)
func (b *IdentityAccessManagementAPIBuilder) AfterTeamBindingCreate(obj runtime.Object, _ *metav1.CreateOptions) {
	if b.zClient == nil {
		return
	}

	tb, ok := obj.(*iamv0.TeamBinding)
	if !ok {
		b.logger.Error("failed to convert object to TeamBinding type", "object", obj)
		return
	}

	resourceType := "teambinding"
	operation := "create"

	// Grab a ticket to write to Zanzana
	// This limits the amount of concurrent connections to Zanzana
	wait := time.Now()
	b.zTickets <- true
	hooksWaitHistogram.WithLabelValues(resourceType, operation).Observe(time.Since(wait).Seconds())

	go func(tb *iamv0.TeamBinding) {
		start := time.Now()
		status := "success"

		defer func() {
			// Release the ticket after write is done
			<-b.zTickets
			// Record operation duration and count
			hooksDurationHistogram.WithLabelValues(resourceType, operation, status).Observe(time.Since(start).Seconds())
			hooksOperationCounter.WithLabelValues(resourceType, operation, status).Inc()
		}()

		b.logger.Debug("writing team binding to zanzana",
			"namespace", tb.Namespace,
			"name", tb.Name,
			"subject", tb.Spec.Subject.Name,
			"teamRef", tb.Spec.TeamRef.Name,
			"permission", tb.Spec.Permission,
		)

		ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
		defer cancel()

		err := b.zClient.Mutate(ctx, &v1.MutateRequest{
			Namespace: tb.Namespace,
			Operations: []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_CreateTeamBinding{
						CreateTeamBinding: &v1.CreateTeamBindingOperation{
							SubjectName: tb.Spec.Subject.Name,
							TeamName:    tb.Spec.TeamRef.Name,
							Permission:  string(tb.Spec.Permission),
						},
					},
				},
			},
		})

		if err != nil {
			status = "failure"
			b.logger.Error("failed to write team binding to zanzana",
				"err", err,
				"namespace", tb.Namespace,
				"name", tb.Name,
				"subject", tb.Spec.Subject.Name,
				"teamRef", tb.Spec.TeamRef.Name,
				"permission", tb.Spec.Permission,
			)
		} else {
			// Record successful tuple write
			hooksTuplesCounter.WithLabelValues(resourceType, operation, "write").Inc()
		}
	}(tb.DeepCopy()) // Pass a copy of the object
}

// BeginTeamBindingUpdate is a pre-update hook that prepares zanzana updates
// It converts old and new team bindings to tuples and performs the zanzana write after K8s update succeeds
func (b *IdentityAccessManagementAPIBuilder) BeginTeamBindingUpdate(ctx context.Context, obj, oldObj runtime.Object, options *metav1.UpdateOptions) (registry.FinishFunc, error) {
	if b.zClient == nil {
		return nil, nil
	}

	// Extract team bindings from both old and new objects
	oldTB, ok := oldObj.(*iamv0.TeamBinding)
	if !ok {
		return nil, nil
	}

	newTB, ok := obj.(*iamv0.TeamBinding)
	if !ok {
		return nil, nil
	}

	if oldTB.Spec.Subject.Name == newTB.Spec.Subject.Name && oldTB.Spec.TeamRef.Name == newTB.Spec.TeamRef.Name && oldTB.Spec.Permission == newTB.Spec.Permission {
		return nil, nil // No changes to the team binding
	}

	if newTB.Spec.Subject.Name == "" || newTB.Spec.TeamRef.Name == "" {
		b.logger.Error("invalid team binding",
			"namespace", newTB.Namespace,
			"name", newTB.Name,
			"subject", newTB.Spec.Subject.Name,
			"teamRef", newTB.Spec.TeamRef.Name,
		)
		return nil, nil
	}

	operations := make([]*v1.MutateOperation, 0, 2)
	operations = append(operations, &v1.MutateOperation{
		Operation: &v1.MutateOperation_DeleteTeamBinding{
			DeleteTeamBinding: &v1.DeleteTeamBindingOperation{
				SubjectName: oldTB.Spec.Subject.Name,
				TeamName:    oldTB.Spec.TeamRef.Name,
				Permission:  string(oldTB.Spec.Permission),
			},
		},
	})
	operations = append(operations, &v1.MutateOperation{
		Operation: &v1.MutateOperation_CreateTeamBinding{
			CreateTeamBinding: &v1.CreateTeamBindingOperation{
				SubjectName: newTB.Spec.Subject.Name,
				TeamName:    newTB.Spec.TeamRef.Name,
				Permission:  string(newTB.Spec.Permission),
			},
		},
	})
	if len(operations) == 0 {
		b.logger.Debug("no updates to team binding in zanzana", "namespace", newTB.Namespace, "name", newTB.Name)
		return func(ctx context.Context, success bool) {}, nil
	}

	// Return a finish function that performs the zanzana write only on success
	return func(ctx context.Context, success bool) {
		if !success {
			return
		}

		wait := time.Now()
		b.zTickets <- true
		hooksWaitHistogram.WithLabelValues("teambinding", "update").Observe(time.Since(wait).Seconds())

		go func() {
			start := time.Now()
			status := "success"

			defer func() {
				<-b.zTickets
				// Record operation duration and count
				hooksDurationHistogram.WithLabelValues("teambinding", "update", status).Observe(time.Since(start).Seconds())
				hooksOperationCounter.WithLabelValues("teambinding", "update", status).Inc()
			}()

			b.logger.Debug("updating team binding in zanzana",
				"namespace", newTB.Namespace,
				"name", newTB.Name,
				"oldSubject", oldTB.Spec.Subject.Name,
				"newSubject", newTB.Spec.Subject.Name,
				"oldTeamRef", oldTB.Spec.TeamRef.Name,
				"newTeamRef", newTB.Spec.TeamRef.Name,
				"oldPermission", oldTB.Spec.Permission,
				"newPermission", newTB.Spec.Permission,
			)

			ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
			defer cancel()

			// Only make the request if there are deletes or writes
			err := b.zClient.Mutate(ctx, &v1.MutateRequest{
				Namespace:  newTB.Namespace,
				Operations: operations,
			})
			if err != nil {
				status = "failure"
				b.logger.Error("failed to update team binding in zanzana",
					"err", err,
					"namespace", newTB.Namespace,
					"name", newTB.Name,
				)
			} else {
				// Record successful tuple operations
				hooksTuplesCounter.WithLabelValues("teambinding", "update", "delete").Inc()
				hooksTuplesCounter.WithLabelValues("teambinding", "update", "write").Inc()
			}
		}()
	}, nil
}

// AfterTeamBindingDelete is a post-delete hook that removes the team binding from Zanzana (openFGA)
func (b *IdentityAccessManagementAPIBuilder) AfterTeamBindingDelete(obj runtime.Object, _ *metav1.DeleteOptions) {
	if b.zClient == nil {
		return
	}

	tb, ok := obj.(*iamv0.TeamBinding)
	if !ok {
		b.logger.Error("failed to convert object to TeamBinding type", "object", obj)
		return
	}

	resourceType := "teambinding"
	operation := "delete"

	// Grab a ticket to write to Zanzana
	// This limits the amount of concurrent connections to Zanzana
	wait := time.Now()
	b.zTickets <- true
	hooksWaitHistogram.WithLabelValues(resourceType, operation).Observe(time.Since(wait).Seconds())

	go func(tb *iamv0.TeamBinding) {
		start := time.Now()
		status := "success"

		defer func() {
			// Release the ticket after write is done
			<-b.zTickets
			// Record operation duration and count
			hooksDurationHistogram.WithLabelValues(resourceType, operation, status).Observe(time.Since(start).Seconds())
			hooksOperationCounter.WithLabelValues(resourceType, operation, status).Inc()
		}()

		b.logger.Debug("deleting team binding from zanzana",
			"namespace", tb.Namespace,
			"name", tb.Name,
			"subject", tb.Spec.Subject.Name,
			"teamRef", tb.Spec.TeamRef.Name,
			"permission", tb.Spec.Permission,
		)

		ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
		defer cancel()

		err := b.zClient.Mutate(ctx, &v1.MutateRequest{
			Namespace: tb.Namespace,
			Operations: []*v1.MutateOperation{
				{
					Operation: &v1.MutateOperation_DeleteTeamBinding{
						DeleteTeamBinding: &v1.DeleteTeamBindingOperation{
							SubjectName: tb.Spec.Subject.Name,
							TeamName:    tb.Spec.TeamRef.Name,
							Permission:  string(tb.Spec.Permission),
						},
					},
				},
			},
		})
		if err != nil {
			status = "failure"
			b.logger.Error("failed to delete team binding from zanzana",
				"err", err,
				"namespace", tb.Namespace,
				"name", tb.Name,
				"subject", tb.Spec.Subject.Name,
				"teamRef", tb.Spec.TeamRef.Name,
			)
		} else {
			// Record successful tuple deletion
			hooksTuplesCounter.WithLabelValues(resourceType, operation, "delete").Inc()
		}
	}(tb.DeepCopy()) // Pass a copy of the object
}
