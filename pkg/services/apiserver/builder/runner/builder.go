package runner

import (
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

var _ AppBuilder = (*appBuilder)(nil)

type LegacyStorageGetter func(schema.GroupVersionResource) grafanarest.Storage

type AppBuilderConfig struct {
	Authorizer          authorizer.Authorizer
	LegacyStorageGetter LegacyStorageGetter
	OpenAPIDefGetter    common.GetOpenAPIDefinitions
	ManagedKinds        map[schema.GroupVersion][]resource.Kind
	CustomConfig        any
	// Do not set anything here unless you have special circumstances! This is a list of resources that are allowed to be accessed in v0alpha1,
	// to prevent accidental exposure of experimental APIs. While developing, use the feature flag `grafanaAPIServerWithExperimentalAPIs`.
	// And then, when you're ready to expose this to the end user, go to v1beta1 instead.
	AllowedV0Alpha1Resources []string

	groupVersion schema.GroupVersion
}

type AppBuilder interface {
	builder.APIGroupBuilder
	builder.APIGroupMutation
	builder.APIGroupValidation
	SetApp(app app.App)
}

type appBuilder struct {
	app    app.App
	config AppBuilderConfig
}

func NewAppBuilder(appBuilderConfig AppBuilderConfig) (*appBuilder, error) {
	return &appBuilder{
		config: appBuilderConfig,
	}, nil
}

func (b *appBuilder) SetApp(app app.App) {
	b.app = app
}

// GetGroupVersion implements APIGroupBuilder.GetGroupVersion
func (b *appBuilder) GetGroupVersion() schema.GroupVersion {
	return b.config.groupVersion
}

// InstallSchema implements APIGroupBuilder.InstallSchema
func (b *appBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := b.GetGroupVersion()
	for _, kinds := range b.config.ManagedKinds {
		for _, kind := range kinds {
			scheme.AddKnownTypeWithName(gv.WithKind(kind.Kind()), kind.ZeroValue())
			scheme.AddKnownTypeWithName(gv.WithKind(kind.Kind()+"List"), kind.ZeroListValue())

			// Link this group to the internal representation.
			// This is used for server-side-apply (PATCH), and avoids the error:
			// "no kind is registered for the type"
			gvInternal := schema.GroupVersion{
				Group:   gv.Group,
				Version: runtime.APIVersionInternal,
			}

			// only register internal kind once
			if _, ok := scheme.KnownTypes(gvInternal)[kind.Kind()]; !ok {
				scheme.AddKnownTypeWithName(gvInternal.WithKind(kind.Kind()), kind.ZeroValue())
				scheme.AddKnownTypeWithName(gvInternal.WithKind(kind.Kind()+"List"), kind.ZeroListValue())
			}

			if len(kind.SelectableFields()) == 0 {
				continue
			}
			gvk := gv.WithKind(kind.Kind())
			err := scheme.AddFieldLabelConversionFunc(
				gvk,
				func(label, value string) (string, string, error) {
					if label == "metadata.name" || label == "metadata.namespace" {
						return label, value, nil
					}
					fields := kind.SelectableFields()
					for _, field := range fields {
						if field.FieldSelector == label {
							return label, value, nil
						}
					}
					return "", "", fmt.Errorf("field label not supported for %s: %s", gvk, label)
				},
			)
			if err != nil {
				return err
			}
		}
	}
	return scheme.SetVersionPriority(gv)
}

// AllowedV0Alpha1Resources returns the list of resources that are allowed to be accessed in v0alpha1
func (b *appBuilder) AllowedV0Alpha1Resources() []string {
	return b.config.AllowedV0Alpha1Resources
}

// UpdateAPIGroupInfo implements APIGroupBuilder.UpdateAPIGroupInfo
func (b *appBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	for _, kinds := range b.config.ManagedKinds {
		for _, kind := range kinds {
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
			if registryStore, ok := store.(*genericregistry.Store); ok {
				for subPath := range kind.ZeroValue().GetSubresources() {
					apiGroupInfo.VersionedResourcesStorageMap[version][resourceInfo.StoragePath(subPath)] = grafanaregistry.NewRegistryStatusStore(opts.Scheme, registryStore)
				}
			}
		}
	}
	return nil
}

func (b *appBuilder) getStorage(resourceInfo utils.ResourceInfo, opts builder.APIGroupOptions) (grafanarest.Storage, error) {
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
func (b *appBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return b.config.OpenAPIDefGetter
}

// GetAuthorizer implements APIGroupBuilder.GetAuthorizer
func (b *appBuilder) GetAuthorizer() authorizer.Authorizer {
	return b.config.Authorizer
}
