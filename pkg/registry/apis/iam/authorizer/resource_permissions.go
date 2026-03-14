package authorizer

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/types"
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

// CanViewTarget returns whether the caller has get_permissions on the given target resource.
// authInfo must be the authenticated identity (e.g. from types.AuthInfoFrom(ctx)); pass it in so callers can fetch once when looping.
func (r *ResourcePermissionsAuthorizer) CanViewTarget(ctx context.Context, authInfo types.AuthInfo, namespace, apiGroup, resource, name string) (bool, error) {
	if authInfo == nil {
		return false, storewrapper.ErrUnauthenticated
	}
	targetGR := schema.GroupResource{Group: apiGroup, Resource: resource}
	parent := ""
	if !isAccessPolicy(authInfo) && r.parentProvider.HasParent(targetGR) {
		gotParent, err := r.parentProvider.GetParent(ctx, targetGR, namespace, name)
		if err != nil {
			r.logger.Debug("can view target: error fetching parent, denying",
				"error", fmt.Sprintf("%v", err), "namespace", namespace, "group", apiGroup, "resource", resource, "name", name)
			return false, nil
		}
		parent = gotParent
	}
	checkReq := types.CheckRequest{
		Namespace: namespace,
		Group:     apiGroup,
		Resource:  resource,
		Verb:      utils.VerbGetPermissions,
		Name:      name,
	}
	res, err := r.accessClient.Check(ctx, authInfo, checkReq, parent)
	if err != nil {
		return false, err
	}
	return res.Allowed, nil
}

// AfterGet implements ResourceStorageAuthorizer.
func (r *ResourcePermissionsAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
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
			return fmt.Errorf(
				"user cannot set permissions on resource %s/%s/%s: %w",
				target.ApiGroup, target.Resource, target.Name, storewrapper.ErrUnauthorized,
			)
		}
		return nil
	default:
		return fmt.Errorf("expected ResourcePermission, got %T: %w", o, storewrapper.ErrUnexpectedType)
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
			return fmt.Errorf(
				"user cannot set permissions on resource %s/%s/%s: %w",
				target.ApiGroup, target.Resource, target.Name, storewrapper.ErrUnauthorized,
			)
		}
		return nil
	default:
		return fmt.Errorf("expected ResourcePermission, got %T: %w", o, storewrapper.ErrUnexpectedType)
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
	switch l := list.(type) {
	case *iamv0.ResourcePermissionList:
		authInfo, ok := types.AuthInfoFrom(ctx)
		if !ok {
			return nil, storewrapper.ErrUnauthenticated
		}
		filtered := make([]iamv0.ResourcePermission, 0, len(l.Items))
		for _, item := range l.Items {
			target := item.Spec.Resource
			allowed, err := r.CanViewTarget(ctx, authInfo, item.Namespace, target.ApiGroup, target.Resource, target.Name)
			if err != nil {
				return nil, err
			}
			if allowed {
				filtered = append(filtered, item)
			}
		}
		l.Items = filtered
		return l, nil
	default:
		return nil, fmt.Errorf("expected ResourcePermissionList, got %T: %w", l, storewrapper.ErrUnexpectedType)
	}
}
