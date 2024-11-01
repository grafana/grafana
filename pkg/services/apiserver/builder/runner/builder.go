package runner

import (
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

var (
	_ builder.APIGroupBuilder    = (*AppBuilder)(nil)
	_ builder.APIGroupMutation   = (*AppBuilder)(nil)
	_ builder.APIGroupValidation = (*AppBuilder)(nil)
)

type LegacyStorageGetter func(schema.GroupVersionResource) grafanarest.LegacyStorage

type AppBuilderConfig struct {
	Authorizer          authorizer.Authorizer
	LegacyStorageGetter LegacyStorageGetter
	OpenAPIDefGetter    common.GetOpenAPIDefinitions
	ManagedKinds        map[schema.GroupVersion]resource.Kind
	CustomConfig        any

	groupVersion schema.GroupVersion
}

type AppBuilder struct {
	app    app.App
	config AppBuilderConfig
}

func NewAppBuilder(appBuilderConfig AppBuilderConfig) (AppBuilder, error) {
	return AppBuilder{
		config: appBuilderConfig,
	}, nil
}

func (b *AppBuilder) setApp(app app.App) {
	b.app = app
}

// GetGroupVersion implements APIGroupBuilder.GetGroupVersion
func (b *AppBuilder) GetGroupVersion() schema.GroupVersion {
	return b.config.groupVersion
}

// InstallSchema implements APIGroupBuilder.InstallSchema
func (b *AppBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := b.GetGroupVersion()
	for _, kind := range b.config.ManagedKinds {
		scheme.AddKnownTypeWithName(gv.WithKind(kind.Kind()), kind.ZeroValue())
		scheme.AddKnownTypeWithName(gv.WithKind(kind.Kind()+"List"), kind.ZeroListValue())
	}
	return scheme.SetVersionPriority(gv)
}

// UpdateAPIGroupInfo implements APIGroupBuilder.UpdateAPIGroupInfo
func (b *AppBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	for _, kind := range b.config.ManagedKinds {
		version := kind.GroupVersionKind().Version
		if _, ok := apiGroupInfo.VersionedResourcesStorageMap[version]; !ok {
			apiGroupInfo.VersionedResourcesStorageMap[version] = make(map[string]rest.Storage)
		}
		resourceInfo := KindToResourceInfo(kind)
		store, err := b.getStorage(resourceInfo, opts)
		if err != nil {
			return err
		}
		apiGroupInfo.VersionedResourcesStorageMap[version][resourceInfo.StoragePath()] = store
	}
	return nil
}

func (b *AppBuilder) getStorage(resourceInfo utils.ResourceInfo, opts builder.APIGroupOptions) (grafanarest.Storage, error) {
	store, err := grafanaregistry.NewRegistryStore(opts.Scheme, resourceInfo, opts.OptsGetter)
	if err != nil {
		return nil, err
	}
	if b.config.LegacyStorageGetter != nil && opts.DualWriteBuilder != nil {
		if legacyStorage := b.config.LegacyStorageGetter(resourceInfo.GroupVersionResource()); legacyStorage != nil {
			return opts.DualWriteBuilder(resourceInfo.GroupResource(), legacyStorage, store)
		}
	}
	return store, nil
}

// GetOpenAPIDefinitions implements APIGroupBuilder.GetOpenAPIDefinitions
func (b *AppBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return b.config.OpenAPIDefGetter
}

// GetAPIRoutes implements APIGroupBuilder.GetAPIRoutes
func (b *AppBuilder) GetAPIRoutes() *builder.APIRoutes {
	// TODO: The API routes are not yet exposed by the app.App interface.
	return nil
}

// GetAuthorizer implements APIGroupBuilder.GetAuthorizer
func (b *AppBuilder) GetAuthorizer() authorizer.Authorizer {
	return b.config.Authorizer
}
