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
func (r *ResourcePermissionsAuthorizer) BeforeUpdate(ctx context.Context, obj runtime.Object) error {
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
		var (
			filteredItems []iamv0.ResourcePermission
			err           error
			canViewFuncs  = map[schema.GroupResource]types.ItemChecker{}
		)
		for _, item := range l.Items {
			gr := schema.GroupResource{
				Group:    item.Spec.Resource.ApiGroup,
				Resource: item.Spec.Resource.Resource,
			}

			// Reuse the same canView for items with the same resource
			canView, found := canViewFuncs[gr]

			if !found {
				listReq := types.ListRequest{
					Namespace: item.Namespace,
					Group:     item.Spec.Resource.ApiGroup,
					Resource:  item.Spec.Resource.Resource,
					Verb:      utils.VerbGetPermissions,
				}

				canView, _, err = r.accessClient.Compile(ctx, authInfo, listReq)
				if err != nil {
					return nil, err
				}

				canViewFuncs[gr] = canView
			}

			target := item.Spec.Resource
			targetGR := schema.GroupResource{Group: target.ApiGroup, Resource: target.Resource}

			parent := ""
			// Fetch the parent of the resource
			// It's not efficient to do for every item in the list, but it's a good starting point.
			// Access Policies have global scope, so no parent check needed
			if !isAccessPolicy(authInfo) && r.parentProvider.HasParent(targetGR) {
				p, err := r.parentProvider.GetParent(ctx, targetGR, item.Namespace, target.Name)
				if err != nil {
					// Skip item on error fetching parent
					r.logger.Warn("filter list: error fetching parent, skipping item",
						"error", err.Error(),
						"namespace", item.Namespace,
						"group", target.ApiGroup,
						"resource", target.Resource,
						"name", target.Name,
					)
					continue
				}
				parent = p
			}

			allowed := canView(item.Spec.Resource.Name, parent)
			if allowed {
				filteredItems = append(filteredItems, item)
			}
		}
		l.Items = filteredItems
		return l, nil
	default:
		return nil, fmt.Errorf("expected ResourcePermissionList, got %T: %w", l, storewrapper.ErrUnexpectedType)
	}
}
