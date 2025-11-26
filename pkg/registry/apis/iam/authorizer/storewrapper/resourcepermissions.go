package storewrapper

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/types"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// TODO: Logs, Metrics, Traces?

type ResourcePermissionsAuthorizer struct {
	accessClient types.AccessClient
	// configProvider func(ctx context.Context) (*rest.Config, error)
}

func NewResourcePermissionsAuthorizer(accessClient types.AccessClient) *ResourcePermissionsAuthorizer {
	return &ResourcePermissionsAuthorizer{
		accessClient: accessClient,
	}
}

// TODO: This will be needed for checking parent folder permissions
//       But this will probably require some configuration files to map groupResource to api urls and versions
// func (r *ResourcePermissionsAuthorizer) client(ctx context.Context, namespace string, gr schema.GroupVersionResource) (dynamic.ResourceInterface, error) {
// 	restConfig, err := r.configProvider(ctx)
// 	if err != nil {
// 		return nil, err
// 	}
// 	client, err := dynamic.NewForConfig(restConfig)
// 	if err != nil {
// 		return nil, err
// 	}

// 	return client.Resource(gr).Namespace(namespace), nil
// }

// AfterGet implements ResourceStorageAuthorizer.
func (r *ResourcePermissionsAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return errUnauthenticated
	}
	switch o := obj.(type) {
	case *iamv0.ResourcePermission:
		target := o.Spec.Resource

		// TODO: Fetch the resource to retrieve its parent folder.
		parent := ""

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
			return errUnauthorized
		}
		return nil
	default:
		return fmt.Errorf("expected ResourcePermission, got %T: %w", o, errUnexpectedType)
	}
}

func (r *ResourcePermissionsAuthorizer) beforeWrite(ctx context.Context, obj runtime.Object) error {
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return errUnauthenticated
	}
	switch o := obj.(type) {
	case *iamv0.ResourcePermission:
		target := o.Spec.Resource

		// TODO: Fetch the resource to retrieve its parent folder.
		parent := ""

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
			return errUnauthorized
		}
		return nil
	default:
		return fmt.Errorf("expected ResourcePermission, got %T: %w", o, errUnexpectedType)
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
		return nil, errUnauthenticated
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

			// TODO : Fetch the resource to retrieve its parent folder.
			parent := ""

			allowed := canView(item.Spec.Resource.Name, parent)
			if allowed {
				filteredItems = append(filteredItems, item)
			}
		}
		l.Items = filteredItems
		return l, nil
	default:
		return nil, fmt.Errorf("expected ResourcePermissionList, got %T: %w", l, errUnexpectedType)
	}
}

var _ ResourceStorageAuthorizer = (*ResourcePermissionsAuthorizer)(nil)
