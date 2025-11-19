package iam

import (
	"context"
	"errors"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic/registry"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

var (
	errEmptyName = errors.New("name cannot be empty")

	defaultWriteTimeout = 15 * time.Second
)

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

		operations := make([]*v1.MutateOperation, 0, len(permissions))
		for _, p := range permissions {
			operations = append(operations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_CreatePermission{
					CreatePermission: &v1.CreatePermissionOperation{
						Resource: &v1.Resource{
							Group:    resource.ApiGroup,
							Resource: resource.Resource,
							Name:     resource.Name,
						},
						Permission: &v1.Permission{
							Kind: string(p.Kind),
							Name: p.Name,
							Verb: p.Verb,
						},
					},
				},
			})
		}

		if len(operations) == 0 {
			return
		}

		b.logger.Debug("writing resource permission to zanzana",
			"namespace", rp.Namespace,
			"resource", resource,
			"operationsCount", len(operations),
		)

		ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
		defer cancel()

		err := b.zClient.Mutate(ctx, &v1.MutateRequest{
			Namespace:  rp.Namespace,
			Operations: operations,
		})
		if err != nil {
			status = "failure"
			b.logger.Error("failed to write resource permission to zanzana",
				"err", err,
				"namespace", rp.Namespace,
				"resource", resource,
				"operationsCount", len(operations),
			)
		} else {
			// Record successful tuple writes
			hooksTuplesCounter.WithLabelValues(resourceType, operation, "write").Add(float64(len(operations)))
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

	// Convert old permissions to delete operations
	deleteOperations := make([]*v1.MutateOperation, 0, len(oldRP.Spec.Permissions))
	if len(oldRP.Spec.Permissions) > 0 {
		oldResource := oldRP.Spec.Resource
		for _, p := range oldRP.Spec.Permissions {
			deleteOperations = append(deleteOperations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_DeletePermission{
					DeletePermission: &v1.DeletePermissionOperation{
						Resource: &v1.Resource{
							Group:    oldResource.ApiGroup,
							Resource: oldResource.Resource,
							Name:     oldResource.Name,
						},
						Permission: &v1.Permission{
							Kind: string(p.Kind),
							Name: p.Name,
							Verb: p.Verb,
						},
					},
				},
			})
		}
	}

	// Convert new permissions to create operations
	createOperations := make([]*v1.MutateOperation, 0, len(newRP.Spec.Permissions))
	if len(newRP.Spec.Permissions) > 0 {
		newResource := newRP.Spec.Resource
		for _, p := range newRP.Spec.Permissions {
			createOperations = append(createOperations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_CreatePermission{
					CreatePermission: &v1.CreatePermissionOperation{
						Resource: &v1.Resource{
							Group:    newResource.ApiGroup,
							Resource: newResource.Resource,
							Name:     newResource.Name,
						},
						Permission: &v1.Permission{
							Kind: string(p.Kind),
							Name: p.Name,
							Verb: p.Verb,
						},
					},
				},
			})
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
			req := &v1.MutateRequest{
				Namespace:  newRP.Namespace,
				Operations: append(deleteOperations, createOperations...),
			}

			if len(req.Operations) == 0 {
				return
			}

			if len(deleteOperations) > 0 {
				b.logger.Debug("deleting existing resource permissions from zanzana",
					"namespace", newRP.Namespace,
					"operationsCount", len(deleteOperations),
				)
			}

			if len(createOperations) > 0 {
				b.logger.Debug("writing new resource permissions to zanzana",
					"namespace", newRP.Namespace,
					"operationsCount", len(createOperations),
				)
			}

			// Only make the request if there are deletes or writes
			if len(req.Operations) > 0 {
				err := b.zClient.Mutate(ctx, req)
				if err != nil {
					status = "failure"
					b.logger.Error("failed to update resource permission in zanzana",
						"err", err,
						"namespace", newRP.Namespace,
					)
				} else {
					// Record successful tuple operations
					if len(deleteOperations) > 0 {
						hooksTuplesCounter.WithLabelValues("resourcepermission", "update", "delete").Add(float64(len(deleteOperations)))
					}
					if len(createOperations) > 0 {
						hooksTuplesCounter.WithLabelValues("resourcepermission", "update", "write").Add(float64(len(createOperations)))
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

		// Generate delete tuples from the permissions
		deleteOperations := make([]*v1.MutateOperation, 0, len(permissions))
		for _, p := range permissions {
			deleteOperations = append(deleteOperations, &v1.MutateOperation{
				Operation: &v1.MutateOperation_DeletePermission{
					DeletePermission: &v1.DeletePermissionOperation{
						Resource: &v1.Resource{
							Group:    resource.ApiGroup,
							Resource: resource.Resource,
							Name:     resource.Name,
						},
						Permission: &v1.Permission{
							Kind: string(p.Kind),
							Name: p.Name,
							Verb: p.Verb,
						},
					},
				},
			})
		}

		// Avoid writing if there are no valid tuples
		if len(deleteOperations) == 0 {
			return
		}

		b.logger.Debug("deleting resource permission from zanzana",
			"namespace", rp.Namespace,
			"resource", resource,
			"operationsCount", len(deleteOperations),
		)

		ctx, cancel := context.WithTimeout(context.Background(), defaultWriteTimeout)
		defer cancel()

		err := b.zClient.Mutate(ctx, &v1.MutateRequest{
			Namespace:  rp.Namespace,
			Operations: deleteOperations,
		})
		if err != nil {
			status = "failure"
			b.logger.Error("failed to delete resource permission from zanzana",
				"err", err,
				"namespace", rp.Namespace,
				"resource", resource,
				"operationsCount", len(deleteOperations),
			)
		} else {
			// Record successful tuple deletions
			hooksTuplesCounter.WithLabelValues(resourceType, operation, "delete").Add(float64(len(deleteOperations)))
		}
	}(rp.DeepCopy()) // Pass a copy of the object
}
