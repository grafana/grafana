package scope

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/prometheus/client_golang/prometheus"

	scope "github.com/grafana/grafana/pkg/apis/scope/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var _ builder.APIGroupBuilder = (*ScopeAPIBuilder)(nil)

// This is used just so wire has something unique to return
type ScopeAPIBuilder struct{}

func NewScopeAPIBuilder() *ScopeAPIBuilder {
	return &ScopeAPIBuilder{}
}

func RegisterAPIService(features featuremgmt.FeatureToggles, apiregistration builder.APIRegistrar, reg prometheus.Registerer) *ScopeAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}
	builder := NewScopeAPIBuilder()
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *ScopeAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return nil // default authorizer is fine
}

func (b *ScopeAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return scope.SchemeGroupVersion
}

func (b *ScopeAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	err := scope.AddToScheme(scheme)
	if err != nil {
		return err
	}

	err = scheme.AddFieldLabelConversionFunc(
		scope.ScopeResourceInfo.GroupVersionKind(),
		func(label, value string) (string, string, error) {
			fieldSet := SelectableScopeFields(&scope.Scope{})
			for key := range fieldSet {
				if label == key {
					return label, value, nil
				}
			}
			return "", "", fmt.Errorf("field label not supported for %s: %s", scope.ScopeResourceInfo.GroupVersionKind(), label)
		},
	)
	if err != nil {
		return err
	}

	err = scheme.AddFieldLabelConversionFunc(
		scope.ScopeDashboardBindingResourceInfo.GroupVersionKind(),
		func(label, value string) (string, string, error) {
			fieldSet := SelectableScopeDashboardBindingFields(&scope.ScopeDashboardBinding{})
			for key := range fieldSet {
				if label == key {
					return label, value, nil
				}
			}
			return "", "", fmt.Errorf("field label not supported for %s: %s", scope.ScopeDashboardBindingResourceInfo.GroupVersionKind(), label)
		},
	)
	if err != nil {
		return err
	}

	err = scheme.AddFieldLabelConversionFunc(
		scope.ScopeNodeResourceInfo.GroupVersionKind(),
		func(label, value string) (string, string, error) {
			fieldSet := SelectableScopeNodeFields(&scope.ScopeNode{})
			for key := range fieldSet {
				if label == key {
					return label, value, nil
				}
			}
			return "", "", fmt.Errorf("field label not supported for %s: %s", scope.ScopeNodeResourceInfo.GroupVersionKind(), label)
		},
	)
	if err != nil {
		return err
	}

	// This is required for --server-side apply
	err = scope.AddKnownTypes(scope.InternalGroupVersion, scheme)
	if err != nil {
		return err
	}

	// Only one version right now
	return scheme.SetVersionPriority(scope.SchemeGroupVersion)
}

func (b *ScopeAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory,
	optsGetter generic.RESTOptionsGetter,
	_ grafanarest.DualWriteBuilder,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(scope.GROUP, scheme, metav1.ParameterCodec, codecs)

	scopeResourceInfo := scope.ScopeResourceInfo
	scopeDashboardResourceInfo := scope.ScopeDashboardBindingResourceInfo
	scopeNodeResourceInfo := scope.ScopeNodeResourceInfo

	storage := map[string]rest.Storage{}

	scopeStorage, err := newScopeStorage(scheme, optsGetter)
	if err != nil {
		return nil, err
	}
	storage[scopeResourceInfo.StoragePath()] = scopeStorage

	scopeDashboardStorage, err := newScopeDashboardBindingStorage(scheme, optsGetter)
	if err != nil {
		return nil, err
	}
	storage[scopeDashboardResourceInfo.StoragePath()] = scopeDashboardStorage

	scopeNodeStorage, err := newScopeNodeStorage(scheme, optsGetter)
	if err != nil {
		return nil, err
	}
	storage[scopeNodeResourceInfo.StoragePath()] = scopeNodeStorage

	// Adds a rest.Connector
	// NOTE! the server has a hardcoded rewrite filter that fills in a name
	// so the standard k8s plumbing continues to work
	storage["scope_node_children"] = &findREST{scopeNodeStorage: scopeNodeStorage}

	// Adds a rest.Connector
	// NOTE! the server has a hardcoded rewrite filter that fills in a name
	// so the standard k8s plumbing continues to work
	storage["scope_dashboard_bindings"] = &findScopeDashboardsREST{scopeDashboardStorage: scopeDashboardStorage}

	apiGroupInfo.VersionedResourcesStorageMap[scope.VERSION] = storage
	return &apiGroupInfo, nil
}

func (b *ScopeAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return scope.GetOpenAPIDefinitions
}

// Register additional routes with the server
func (b *ScopeAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil
}

func (b *ScopeAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	// The plugin description
	oas.Info.Description = "Grafana scopes"

	// The root api URL
	root := "/apis/" + b.GetGroupVersion().String() + "/"

	// Add query parameters to the rest.Connector
	sub := oas.Paths.Paths[root+"namespaces/{namespace}/scope_node_children/{name}"]
	if sub != nil && sub.Get != nil {
		sub.Parameters = []*spec3.Parameter{
			{
				ParameterProps: spec3.ParameterProps{
					Name:        "namespace",
					In:          "path",
					Description: "object name and auth scope, such as for teams and projects",
					Example:     "default",
					Required:    true,
					Schema:      spec.StringProperty().UniqueValues(),
				},
			},
		}
		sub.Get.Description = "Navigate the scopes tree"
		sub.Get.Parameters = []*spec3.Parameter{
			{
				ParameterProps: spec3.ParameterProps{
					Name:        "parent",
					In:          "query",
					Description: "The parent scope node",
				},
			},
		}
		delete(oas.Paths.Paths, root+"namespaces/{namespace}/scope_node_children/{name}")
		oas.Paths.Paths[root+"namespaces/{namespace}/find/scope_node_children"] = sub
	}

	findDashboardPath := oas.Paths.Paths[root+"namespaces/{namespace}/scope_dashboard_bindings/{name}"]
	if findDashboardPath != nil && sub.Get != nil {
		sub.Parameters = []*spec3.Parameter{
			{
				ParameterProps: spec3.ParameterProps{
					Name:        "namespace",
					In:          "path",
					Description: "object name and auth scope, such as for teams and projects",
					Example:     "default",
					Required:    true,
				},
			},
		}
		findDashboardPath.Get.Description = "find scope dashboard bindings that match any of the given scopes."
		findDashboardPath.Get.Parameters = []*spec3.Parameter{
			{
				ParameterProps: spec3.ParameterProps{
					Name:        "scope",
					In:          "query",
					Description: "A scope name (id) to match against, this parameter may be repeated",
				},
			},
		}
		delete(oas.Paths.Paths, root+"namespaces/{namespace}/scope_dashboard_bindings/{name}")
		oas.Paths.Paths[root+"namespaces/{namespace}/find/scope_dashboard_bindings"] = findDashboardPath
	}

	// The root API discovery list
	sub = oas.Paths.Paths[root]
	if sub != nil && sub.Get != nil {
		sub.Get.Tags = []string{"API Discovery"} // sorts first in the list
	}
	return oas, nil
}
