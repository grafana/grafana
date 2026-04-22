package authorizer

import (
	"context"
	"fmt"
	"strconv"

	"github.com/grafana/authlib/types"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
)

// TODO: Logs, Metrics, Traces?

// ParentProvider interface for fetching parent information of resources
type ParentProvider interface {
	// HasParent checks if the given GroupResource has a parent folder
	HasParent(gr schema.GroupResource) bool
	// GetParent fetches the parent folder name for the given resource
	GetParent(ctx context.Context, gr schema.GroupResource, namespace, name string) (string, error)
}

// ResourcePermissionsAuthorizer
type ResourcePermissionsAuthorizer struct {
	accessClient   types.AccessClient
	parentProvider ParentProvider
	logger         log.Logger
}

var _ storewrapper.ResourceStorageAuthorizer = (*ResourcePermissionsAuthorizer)(nil)

func NewResourcePermissionsAuthorizer(
	accessClient types.AccessClient,
	parentProvider ParentProvider,
) *ResourcePermissionsAuthorizer {
	return &ResourcePermissionsAuthorizer{
		accessClient:   accessClient,
		parentProvider: parentProvider,
		logger:         log.New("iam.authorizer.resource-permissions"),
	}
}

func isAccessPolicy(authInfo types.AuthInfo) bool {
	return types.IsIdentityType(authInfo.GetIdentityType(), types.TypeAccessPolicy)
}

// hasUsersPermissionsRead returns true if the caller has users.permissions:read (e.g. scope users:*).
// When true, the caller may see all resource permissions without per-resource get_permissions checks.
func (r *ResourcePermissionsAuthorizer) hasUsersPermissionsRead(ctx context.Context, authInfo types.AuthInfo, namespace string) (bool, error) {
	if authInfo == nil {
		return false, storewrapper.ErrUnauthenticated
	}
	checkReq := types.CheckRequest{
		Namespace: namespace,
		Group:     iamv0.GROUP,
		Resource:  "users",
		Verb:      utils.VerbGetPermissions,
		Name:      "*",
	}
	res, err := r.accessClient.Check(ctx, authInfo, checkReq, "")
	if err != nil {
		return false, err
	}
	return res.Allowed, nil
}

// CanViewTargets returns only items for which the caller has get_permissions on the target resource.
// getTarget(i) supplies the resource identity for item i; when ok is false that item is excluded.
// If the caller has users.permissions:read, returns all items without per-resource checks.
func CanViewTargets[T any](r *ResourcePermissionsAuthorizer, ctx context.Context, authInfo types.AuthInfo, items []T, getTarget func(i int) (namespace, apiGroup, resource, name string, ok bool)) ([]T, error) {
	if authInfo == nil {
		return nil, storewrapper.ErrUnauthenticated
	}
	n := len(items)
	if n == 0 {
		return nil, nil
	}
	// if caller has users.permissions:read, allow all items
	if ns, _, _, _, ok := getTarget(0); ok {
		if allowAll, err := r.hasUsersPermissionsRead(ctx, authInfo, ns); err != nil {
			return nil, err
		} else if allowAll {
			return items, nil
		}
	}
	accessPolicy := isAccessPolicy(authInfo)

	// build checks - use item index as correlation ID so results map back without a side table
	checks := make([]types.BatchCheckItem, 0, n)
	var namespace string
	for i := 0; i < n; i++ {
		ns, apiGroup, resource, name, ok := getTarget(i)
		if !ok {
			continue
		}
		if namespace == "" {
			namespace = ns
		}
		targetGR := schema.GroupResource{Group: apiGroup, Resource: resource}
		parent := ""

		// Fetch the parent of the resource
		// It's not efficient to do for every item in the list, but it's a good starting point.
		// Access Policies have global scope, so no parent check needed
		if !accessPolicy && r.parentProvider.HasParent(targetGR) {
			var err error
			parent, err = r.parentProvider.GetParent(ctx, targetGR, ns, name)
			if err != nil {
				r.logger.Debug("can view targets: error fetching parent, denying this item",
					"error", fmt.Sprintf("%v", err), "namespace", ns, "group", apiGroup, "resource", resource, "name", name)
				continue
			}
		}
		checks = append(checks, types.BatchCheckItem{
			CorrelationID: strconv.Itoa(i),
			Group:         apiGroup,
			Resource:      resource,
			Name:          name,
			Verb:          utils.VerbGetPermissions,
			Folder:        parent,
		})
	}

	allowed := make([]bool, n)
	for start := 0; start < len(checks); start += types.MaxBatchCheckItems {
		end := start + types.MaxBatchCheckItems
		if end > len(checks) {
			end = len(checks)
		}
		res, err := r.accessClient.BatchCheck(ctx, authInfo, types.BatchCheckRequest{
			Namespace: namespace,
			Checks:    checks[start:end],
		})
		if err != nil {
			return nil, err
		}
		for id, result := range res.Results {
			if idx, err := strconv.Atoi(id); err == nil {
				allowed[idx] = result.Allowed
			}
		}
	}

	filtered := make([]T, 0, n)
	for i, item := range items {
		if allowed[i] {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

// AfterGet implements ResourceStorageAuthorizer.
func (r *ResourcePermissionsAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return storewrapper.ErrUnauthenticated
	}
	switch o := obj.(type) {
	case *iamv0.ResourcePermission:
		// if the caller has users.permissions:read, allow access without checking the specific resource
		if ok, err := r.hasUsersPermissionsRead(ctx, authInfo, o.Namespace); err != nil {
			return err
		} else if ok {
			return nil
		}

		target := o.Spec.Resource
		targetGR := schema.GroupResource{Group: target.ApiGroup, Resource: target.Resource}

		parent := ""
		// Fetch the parent of the resource
		// Access Policies have global scope, so no parent check needed
		if !isAccessPolicy(authInfo) && r.parentProvider.HasParent(targetGR) {
			p, err := r.parentProvider.GetParent(ctx, targetGR, o.Namespace, target.Name)
			if err != nil {
				r.logger.Error("after get: error fetching parent", "error", err.Error(),
					"namespace", o.Namespace,
					"group", target.ApiGroup,
					"resource", target.Resource,
					"name", target.Name,
				)
				return err
			}
			parent = p
		}

		checkReq := types.CheckRequest{
			Namespace: o.Namespace,
			Group:     target.ApiGroup,
			Resource:  target.Resource,
			Verb:      utils.VerbGetPermissions,
			Name:      target.Name,
		}
		res, err := r.accessClient.Check(ctx, authInfo, checkReq, parent)
		if err != nil {
			return err
		}
		if !res.Allowed {
			return k8serrors.NewNotFound(targetGR, target.Name)
		}
		return nil
	default:
		return k8serrors.NewBadRequest(fmt.Sprintf("expected ResourcePermission, got %T", o))
	}
}

func (r *ResourcePermissionsAuthorizer) beforeWrite(ctx context.Context, obj runtime.Object) error {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return storewrapper.ErrUnauthenticated
	}
	switch o := obj.(type) {
	case *iamv0.ResourcePermission:
		target := o.Spec.Resource
		targetGR := schema.GroupResource{Group: target.ApiGroup, Resource: target.Resource}

		parent := ""
		// Fetch the parent of the resource
		// Access Policies have global scope, so no parent check needed
		if !isAccessPolicy(authInfo) && r.parentProvider.HasParent(targetGR) {
			p, err := r.parentProvider.GetParent(ctx, targetGR, o.Namespace, target.Name)
			if err != nil {
				r.logger.Error("before write: error fetching parent", "error", err.Error(),
					"namespace", o.Namespace,
					"group", target.ApiGroup,
					"resource", target.Resource,
					"name", target.Name,
				)
				return err
			}
			parent = p
		}

		checkReq := types.CheckRequest{
			Namespace: o.Namespace,
			Group:     target.ApiGroup,
			Resource:  target.Resource,
			Verb:      utils.VerbSetPermissions,
			Name:      target.Name,
		}
		res, err := r.accessClient.Check(ctx, authInfo, checkReq, parent)
		if err != nil {
			return err
		}
		if !res.Allowed {
			return k8serrors.NewForbidden(targetGR, target.Name, fmt.Errorf("user cannot set permissions on this resource"))
		}
		return nil
	default:
		return k8serrors.NewBadRequest(fmt.Sprintf("expected ResourcePermission, got %T", o))
	}
}

// BeforeCreate implements ResourceStorageAuthorizer.
func (r *ResourcePermissionsAuthorizer) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	return r.beforeWrite(ctx, obj)
}

// BeforeDelete implements ResourceStorageAuthorizer.
func (r *ResourcePermissionsAuthorizer) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	return r.beforeWrite(ctx, obj)
}

// BeforeUpdate implements ResourceStorageAuthorizer.
func (r *ResourcePermissionsAuthorizer) BeforeUpdate(ctx context.Context, oldObj, obj runtime.Object) error {
	return r.beforeWrite(ctx, obj)
}

// FilterList implements ResourceStorageAuthorizer.
func (r *ResourcePermissionsAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return nil, storewrapper.ErrUnauthenticated
	}

	switch l := list.(type) {
	case *iamv0.ResourcePermissionList:
		filtered, err := CanViewTargets(r, ctx, authInfo, l.Items, func(i int) (string, string, string, string, bool) {
			t := l.Items[i].Spec.Resource
			return l.Items[i].Namespace, t.ApiGroup, t.Resource, t.Name, true
		})
		if err != nil {
			return nil, err
		}
		l.Items = filtered
		return l, nil
	default:
		return nil, k8serrors.NewBadRequest(fmt.Sprintf("expected ResourcePermissionList, got %T", l))
	}
}
