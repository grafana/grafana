package storewrapper

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/types"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/rest"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// TODO: Logs, Metrics, Traces?

type ResourcePermissionsAuthorizer struct {
	accessClient types.AccessClient
	// configProvider func(ctx context.Context) (*rest.Config, error)
}

func NewResourcePermissionsAuthorizer(
	accessClient types.AccessClient,
	configProvider func(ctx context.Context,
	) (*rest.Config, error)) *ResourcePermissionsAuthorizer {
	return &ResourcePermissionsAuthorizer{
		accessClient: accessClient,
	}
}

// TODO: Implement this will be needed for checking parent folder permissions
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
			Group:    target.ApiGroup,
			Resource: target.Resource,
			Verb:     utils.VerbGetPermissions,
			Name:     target.Name,
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
	panic("unimplemented")
}

// BeforeDelete implements ResourceStorageAuthorizer.
func (r *ResourcePermissionsAuthorizer) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	panic("unimplemented")
}

// BeforeUpdate implements ResourceStorageAuthorizer.
func (r *ResourcePermissionsAuthorizer) BeforeUpdate(ctx context.Context, obj runtime.Object) error {
	panic("unimplemented")
}

// FilterList implements ResourceStorageAuthorizer.
func (r *ResourcePermissionsAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	panic("unimplemented")
}

var _ ResourceStorageAuthorizer = (*ResourcePermissionsAuthorizer)(nil)
