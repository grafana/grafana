package authorizer

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/auth"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
)

// TODO: Logs, Metrics, Traces?

type ParentProvider interface {
	HasParent(gr schema.GroupResource) bool
	GetParent(ctx context.Context, gr schema.GroupResource, namespace, name string) (string, error)
}

// ResourcePermissionsAuthorizer
type ResourcePermissionsAuthorizer struct {
	accessClient   types.AccessClient
	parentProvider ParentProvider
}

var _ storewrapper.ResourceStorageAuthorizer = (*ResourcePermissionsAuthorizer)(nil)

func NewResourcePermissionsAuthorizer(
	accessClient types.AccessClient,
	parentProvider ParentProvider,
) *ResourcePermissionsAuthorizer {
	return &ResourcePermissionsAuthorizer{
		accessClient:   accessClient,
		parentProvider: parentProvider,
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
			// Access Policies have global scope, so no parent check needed
			if !isAccessPolicy(authInfo) && r.parentProvider.HasParent(targetGR) {
				p, err := r.parentProvider.GetParent(ctx, targetGR, item.Namespace, target.Name)
				if err != nil {
					// TODO: Log error
					// Skip item on error fetching parent
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

// func (r *ResourcePermissionsAuthorizer) client(ctx context.Context, namespace string, gr schema.GroupVersionResource) (dynamic.ResourceInterface, error) {
// 	restConfig, err := r.configProvider(ctx, gr.GroupResource())
// 	if err != nil {
// 		return nil, err
// 	}
// 	client, err := dynamic.NewForConfig(restConfig)
// 	if err != nil {
// 		return nil, err
// 	}

// 	return client.Resource(gr).Namespace(namespace), nil
// }

type configProviderByGroupResource map[schema.GroupResource]func(ctx context.Context) (*rest.Config, error)

type ApiParentProvider struct {
	configProviders configProviderByGroupResource
}

type DialConfig struct {
	Host     string
	Insecure bool
	CAFile   string
	Audience string
}

func NewLocalConfigProvider(
	configProvider func(ctx context.Context) (*rest.Config, error),
) configProviderByGroupResource {
	return configProviderByGroupResource{
		{Group: "folder.grafana.app", Resource: "folders"}:       configProvider,
		{Group: "dashboard.grafana.com", Resource: "dashboards"}: configProvider,
	}
}

func NewRemoteConfigProvider(cfg map[schema.GroupResource]DialConfig, exchangeClient authn.TokenExchanger) configProviderByGroupResource {
	configProviders := make(configProviderByGroupResource, 2)
	for gr, dialConfig := range cfg {
		configProviders[gr] = func(ctx context.Context) (*rest.Config, error) {
			return &rest.Config{
				Host: dialConfig.Host,
				WrapTransport: func(rt http.RoundTripper) http.RoundTripper {
					return auth.NewRoundTripper(exchangeClient, rt, dialConfig.Audience)
				},
				TLSClientConfig: rest.TLSClientConfig{
					Insecure: dialConfig.Insecure,
					CAFile:   dialConfig.CAFile,
				},
				QPS:   50,
				Burst: 100,
			}, nil
		}
	}
	return configProviders
}

func NewApiParentProvider(configProviders configProviderByGroupResource) *ApiParentProvider {
	return &ApiParentProvider{configProviders: configProviders}
}

func (p *ApiParentProvider) HasParent(gr schema.GroupResource) bool {
	_, ok := p.configProviders[gr]
	return ok
}

func (p *ApiParentProvider) GetParent(ctx context.Context, gr schema.GroupResource, namespace, name string) (string, error) {
	provider, ok := p.configProviders[gr]
	if !ok {
		return "", fmt.Errorf("no config provider for group resource %s", gr.String())
	}
	restConfig, err := provider(ctx)
	if err != nil {
		return "", err
	}
	client, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return "", err
	}
	resourceClient := client.Resource(schema.GroupVersionResource{
		Group:    gr.Group,
		Version:  "v1alpha1", // TODO: Make dynamic?
		Resource: gr.Resource,
	}).Namespace(namespace)

	unstructObj, err := resourceClient.Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return "", err
	}

	parent, _ := unstructObj.GetAnnotations()[utils.AnnoKeyFolder]
	return parent, nil
}
