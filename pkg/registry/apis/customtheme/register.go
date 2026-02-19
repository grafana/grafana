package customtheme

import (
	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	customtheme "github.com/grafana/grafana/pkg/apis/customtheme/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	roleauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

var _ builder.APIGroupBuilder = (*CustomThemeAPIBuilder)(nil)

type CustomThemeAPIBuilder struct{}

func NewCustomThemeAPIBuilder() *CustomThemeAPIBuilder {
	return &CustomThemeAPIBuilder{}
}

func RegisterAPIService(apiregistration builder.APIRegistrar, registerer prometheus.Registerer) *CustomThemeAPIBuilder {
	b := NewCustomThemeAPIBuilder()
	apiregistration.RegisterAPI(b)
	return b
}

func (b *CustomThemeAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	//nolint:staticcheck // not yet migrated to Resource Authorizer
	return roleauthorizer.NewRoleAuthorizer()
}

func (b *CustomThemeAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return customtheme.SchemeGroupVersion
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&customtheme.CustomTheme{},
		&customtheme.CustomThemeList{},
	)
}

func (b *CustomThemeAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := customtheme.SchemeGroupVersion
	err := customtheme.AddToScheme(scheme)
	if err != nil {
		return err
	}

	addKnownTypes(scheme, schema.GroupVersion{
		Group:   customtheme.GROUP,
		Version: runtime.APIVersionInternal,
	})
	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *CustomThemeAPIBuilder) AllowedV0Alpha1Resources() []string {
	return []string{builder.AllResourcesAllowed}
}

func (b *CustomThemeAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	scheme := opts.Scheme
	optsGetter := opts.OptsGetter

	resourceInfo := customtheme.CustomThemeResourceInfo
	storage := map[string]rest.Storage{}

	customThemeStorage, err := grafanaregistry.NewRegistryStore(scheme, resourceInfo, optsGetter)
	if err != nil {
		return err
	}

	storage[resourceInfo.StoragePath()] = customThemeStorage
	apiGroupInfo.VersionedResourcesStorageMap[customtheme.VERSION] = storage
	return nil
}

func (b *CustomThemeAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return customtheme.GetOpenAPIDefinitions
}
