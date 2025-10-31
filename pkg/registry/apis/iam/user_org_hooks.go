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

// createUserBasicRoleTuple creates a tuple for a user's basic role assignment
func createUserBasicRoleTuple(userUID, orgRole string) *v1.TupleKey {
	if orgRole == "" {
		return nil
	}

	basicRole := zanzana.TranslateBasicRole(orgRole)
	if basicRole == "" {
		return nil
	}

	return &v1.TupleKey{
		User:     zanzana.NewTupleEntry(zanzana.TypeUser, userUID, ""),
		Relation: zanzana.RelationAssignee,
		Object:   zanzana.NewTupleEntry(zanzana.TypeRole, basicRole, ""),
	}
}

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

	resourceType := "user"
	operation := "create"

	// Skip if user has no role assigned
	if user.Spec.Role == "" {
		b.logger.Debug("user has no role assigned, skipping basic role sync",
			"namespace", user.Namespace,
			"userUID", user.Name,
		)
		return
	}

	// Grab a ticket to write to Zanzana
	wait := time.Now()
	b.zTickets <- true
	hooksWaitHistogram.WithLabelValues(resourceType, operation).Observe(time.Since(wait).Seconds())

	go func(u *iamv0.User) {
		start := time.Now()
		status := "success"

		defer func() {
			<-b.zTickets
			hooksDurationHistogram.WithLabelValues(resourceType, operation, status).Observe(time.Since(start).Seconds())
			hooksOperationCounter.WithLabelValues(resourceType, operation, status).Inc()
		}()

		tuple := createUserBasicRoleTuple(u.Name, u.Spec.Role)
		if tuple == nil {
			b.logger.Warn("failed to create user basic role tuple",
				"namespace", u.Namespace,
				"userUID", u.Name,
				"role", u.Spec.Role,
			)
			status = "failure"
			return
		}

		b.logger.Debug("writing user basic role to zanzana",
			"namespace", u.Namespace,
			"userUID", u.Name,
			"role", u.Spec.Role,
		)

		ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
		defer cancel()

		err := b.zClient.Write(ctx, &v1.WriteRequest{
			Namespace: u.Namespace,
			Writes: &v1.WriteRequestWrites{
				TupleKeys: []*v1.TupleKey{tuple},
			},
		})
		if err != nil {
			status = "failure"
			b.logger.Error("failed to write user basic role to zanzana",
				"err", err,
				"namespace", u.Namespace,
				"userUID", u.Name,
				"role", u.Spec.Role,
			)
		} else {
			hooksTuplesCounter.WithLabelValues(resourceType, operation, "write").Inc()
		}
	}(user.DeepCopy())
}

// BeginUserUpdate is a pre-update hook that prepares zanzana updates
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

	// Return a finish function that performs the zanzana write only on success
	return func(ctx context.Context, success bool) {
		if !success {
			return
		}

		wait := time.Now()
		b.zTickets <- true
		hooksWaitHistogram.WithLabelValues("user", "update").Observe(time.Since(wait).Seconds())

		go func(old, new *iamv0.User) {
			start := time.Now()
			status := "success"

			defer func() {
				<-b.zTickets
				hooksDurationHistogram.WithLabelValues("user", "update", status).Observe(time.Since(start).Seconds())
				hooksOperationCounter.WithLabelValues("user", "update", status).Inc()
			}()

			b.logger.Debug("updating user basic role in zanzana",
				"namespace", new.Namespace,
				"userUID", new.Name,
				"oldRole", old.Spec.Role,
				"newRole", new.Spec.Role,
			)

			ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
			defer cancel()

			req := &v1.WriteRequest{
				Namespace: new.Namespace,
			}

			// Delete old role tuple if it existed
			if old.Spec.Role != "" {
				oldTuple := createUserBasicRoleTuple(old.Name, old.Spec.Role)
				if oldTuple != nil {
					deleteTuple := tupleToTupleKeyWithoutCondition(oldTuple)
					req.Deletes = &v1.WriteRequestDeletes{
						TupleKeys: []*v1.TupleKeyWithoutCondition{deleteTuple},
					}
					b.logger.Debug("deleting old user basic role from zanzana",
						"namespace", new.Namespace,
						"userUID", new.Name,
						"role", old.Spec.Role,
					)
				}
			}

			// Write new role tuple if it exists
			if new.Spec.Role != "" {
				newTuple := createUserBasicRoleTuple(new.Name, new.Spec.Role)
				if newTuple != nil {
					req.Writes = &v1.WriteRequestWrites{
						TupleKeys: []*v1.TupleKey{newTuple},
					}
					b.logger.Debug("writing new user basic role to zanzana",
						"namespace", new.Namespace,
						"userUID", new.Name,
						"role", new.Spec.Role,
					)
				}
			}

			// Only make the request if there are deletes or writes
			if (req.Deletes != nil && len(req.Deletes.TupleKeys) > 0) || (req.Writes != nil && len(req.Writes.TupleKeys) > 0) {
				err := b.zClient.Write(ctx, req)
				if err != nil {
					status = "failure"
					b.logger.Error("failed to update user basic role in zanzana",
						"err", err,
						"namespace", new.Namespace,
						"userUID", new.Name,
					)
				} else {
					if req.Deletes != nil && len(req.Deletes.TupleKeys) > 0 {
						hooksTuplesCounter.WithLabelValues("user", "update", "delete").Inc()
					}
					if req.Writes != nil && len(req.Writes.TupleKeys) > 0 {
						hooksTuplesCounter.WithLabelValues("user", "update", "write").Inc()
					}
				}
			} else {
				b.logger.Debug("no tuples to update in zanzana", "namespace", new.Namespace)
			}
		}(oldUser.DeepCopy(), newUser.DeepCopy())
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

	// Skip if user had no role assigned
	if user.Spec.Role == "" {
		b.logger.Debug("user had no role assigned, skipping basic role sync",
			"namespace", user.Namespace,
			"userUID", user.Name,
		)
		return
	}

	wait := time.Now()
	b.zTickets <- true
	hooksWaitHistogram.WithLabelValues(resourceType, operation).Observe(time.Since(wait).Seconds())

	go func(u *iamv0.User) {
		start := time.Now()
		status := "success"

		defer func() {
			<-b.zTickets
			hooksDurationHistogram.WithLabelValues(resourceType, operation, status).Observe(time.Since(start).Seconds())
			hooksOperationCounter.WithLabelValues(resourceType, operation, status).Inc()
		}()

		tuple := createUserBasicRoleTuple(u.Name, u.Spec.Role)
		if tuple == nil {
			b.logger.Warn("failed to create user basic role tuple for deletion",
				"namespace", u.Namespace,
				"userUID", u.Name,
				"role", u.Spec.Role,
			)
			status = "failure"
			return
		}

		deleteTuple := tupleToTupleKeyWithoutCondition(tuple)

		b.logger.Debug("deleting user basic role from zanzana",
			"namespace", u.Namespace,
			"userUID", u.Name,
			"role", u.Spec.Role,
		)

		ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
		defer cancel()

		err := b.zClient.Write(ctx, &v1.WriteRequest{
			Namespace: u.Namespace,
			Deletes: &v1.WriteRequestDeletes{
				TupleKeys: []*v1.TupleKeyWithoutCondition{deleteTuple},
			},
		})
		if err != nil {
			status = "failure"
			b.logger.Error("failed to delete user basic role from zanzana",
				"err", err,
				"namespace", u.Namespace,
				"userUID", u.Name,
				"role", u.Spec.Role,
			)
		} else {
			hooksTuplesCounter.WithLabelValues(resourceType, operation, "delete").Inc()
		}
	}(user.DeepCopy())
}
