package iam

import (
	"context"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic/registry"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

// convertTeamBindingToTuple converts a TeamBinding to a v1 TupleKey format
// TeamBinding represents a user's membership in a team with a specific permission level
func convertTeamBindingToTuple(tb *iamv0.TeamBinding) (*v1.TupleKey, error) {
	if tb.Spec.Subject.Name == "" {
		return nil, errEmptyName
	}

	if tb.Spec.TeamRef.Name == "" {
		return nil, errEmptyName
	}

	// Map permission to relation
	var relation string
	switch tb.Spec.Permission {
	case iamv0.TeamBindingTeamPermissionAdmin:
		relation = zanzana.RelationTeamAdmin
	case iamv0.TeamBindingTeamPermissionMember:
		relation = zanzana.RelationTeamMember
	default:
		// Default to member if unknown permission
		relation = zanzana.RelationTeamMember
	}

	// Create tuple: user:{subjectUID} has {relation} relation to team:{teamUID}
	tuple := &v1.TupleKey{
		User:     zanzana.NewTupleEntry(zanzana.TypeUser, tb.Spec.Subject.Name, ""),
		Relation: relation,
		Object:   zanzana.NewTupleEntry(zanzana.TypeTeam, tb.Spec.TeamRef.Name, ""),
	}

	return tuple, nil
}

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

		tuple, err := convertTeamBindingToTuple(tb)
		if err != nil {
			b.logger.Error("failed to convert team binding to tuple",
				"namespace", tb.Namespace,
				"name", tb.Name,
				"subject", tb.Spec.Subject.Name,
				"teamRef", tb.Spec.TeamRef.Name,
				"permission", tb.Spec.Permission,
				"err", err,
			)
			status = "failure"
			return
		}

		b.logger.Debug("writing team binding to zanzana",
			"namespace", tb.Namespace,
			"name", tb.Name,
			"subject", tb.Spec.Subject.Name,
			"teamRef", tb.Spec.TeamRef.Name,
			"permission", tb.Spec.Permission,
		)

		ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
		defer cancel()

		err = b.zClient.Write(ctx, &v1.WriteRequest{
			Namespace: tb.Namespace,
			Writes: &v1.WriteRequestWrites{
				TupleKeys: []*v1.TupleKey{tuple},
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

	// Convert old team binding to tuple for deletion
	var oldTuple *v1.TupleKey
	var oldErr error
	if oldTB.Spec.Subject.Name != "" && oldTB.Spec.TeamRef.Name != "" {
		oldTuple, oldErr = convertTeamBindingToTuple(oldTB)
		if oldErr != nil {
			b.logger.Error("failed to convert old team binding to tuple",
				"namespace", oldTB.Namespace,
				"name", oldTB.Name,
				"err", oldErr,
			)
			return nil, nil
		}
	}

	// Convert new team binding to tuple for writing
	var newTuple *v1.TupleKey
	var newErr error
	if newTB.Spec.Subject.Name != "" && newTB.Spec.TeamRef.Name != "" {
		newTuple, newErr = convertTeamBindingToTuple(newTB)
		if newErr != nil {
			b.logger.Error("failed to convert new team binding to tuple",
				"namespace", newTB.Namespace,
				"name", newTB.Name,
				"err", newErr,
			)
			return nil, nil
		}
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

			// Prepare write request
			req := &v1.WriteRequest{
				Namespace: newTB.Namespace,
			}

			// Add delete for old tuple
			if oldTuple != nil && oldErr == nil {
				deleteTuple := toTupleKeysWithoutCondition([]*v1.TupleKey{oldTuple})
				req.Deletes = &v1.WriteRequestDeletes{
					TupleKeys: deleteTuple,
				}
				b.logger.Debug("deleting existing team binding from zanzana",
					"namespace", newTB.Namespace,
					"subject", oldTB.Spec.Subject.Name,
					"teamRef", oldTB.Spec.TeamRef.Name,
				)
			}

			// Add write for new tuple
			if newTuple != nil && newErr == nil {
				req.Writes = &v1.WriteRequestWrites{
					TupleKeys: []*v1.TupleKey{newTuple},
				}
				b.logger.Debug("writing new team binding to zanzana",
					"namespace", newTB.Namespace,
					"subject", newTB.Spec.Subject.Name,
					"teamRef", newTB.Spec.TeamRef.Name,
				)
			}

			// Only make the request if there are deletes or writes
			if (req.Deletes != nil && len(req.Deletes.TupleKeys) > 0) || (req.Writes != nil && len(req.Writes.TupleKeys) > 0) {
				err := b.zClient.Write(ctx, req)
				if err != nil {
					status = "failure"
					b.logger.Error("failed to update team binding in zanzana",
						"err", err,
						"namespace", newTB.Namespace,
						"name", newTB.Name,
					)
				} else {
					// Record successful tuple operations
					if oldTuple != nil && oldErr == nil {
						hooksTuplesCounter.WithLabelValues("teambinding", "update", "delete").Inc()
					}
					if newTuple != nil && newErr == nil {
						hooksTuplesCounter.WithLabelValues("teambinding", "update", "write").Inc()
					}
				}
			} else {
				b.logger.Debug("no tuples to update in zanzana", "namespace", newTB.Namespace, "name", newTB.Name)
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

		tuple, err := convertTeamBindingToTuple(tb)
		if err != nil {
			b.logger.Error("failed to convert team binding to tuple for deletion",
				"namespace", tb.Namespace,
				"name", tb.Name,
				"subject", tb.Spec.Subject.Name,
				"teamRef", tb.Spec.TeamRef.Name,
				"err", err,
			)
			status = "failure"
			return
		}

		// Convert tuple to TupleKeyWithoutCondition for deletion
		deleteTuple := toTupleKeysWithoutCondition([]*v1.TupleKey{tuple})

		b.logger.Debug("deleting team binding from zanzana",
			"namespace", tb.Namespace,
			"name", tb.Name,
			"subject", tb.Spec.Subject.Name,
			"teamRef", tb.Spec.TeamRef.Name,
			"permission", tb.Spec.Permission,
		)

		ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
		defer cancel()

		err = b.zClient.Write(ctx, &v1.WriteRequest{
			Namespace: tb.Namespace,
			Deletes: &v1.WriteRequestDeletes{
				TupleKeys: deleteTuple,
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
