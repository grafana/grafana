package runner

import (
	"bytes"
	"context"
	"strings"

	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
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

	group string
}

type AppBuilder interface {
	builder.APIGroupBuilder
	builder.APIGroupVersionsProvider
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

// GetGroupVersions implements APIGroupBuilder.GetGroupVersions
func (b *appBuilder) GetGroupVersions() []schema.GroupVersion {
	gvs := make([]schema.GroupVersion, 0, len(b.config.ManagedKinds))
	for gv := range b.config.ManagedKinds {
		gvs = append(gvs, gv)
	}
	return gvs
}

// InstallSchema implements APIGroupBuilder.InstallSchema
func (b *appBuilder) InstallSchema(scheme *runtime.Scheme) error {
	// Make a map of GroupKind to a single resource.Kind to use as __internal
	internalKinds := make(map[string]resource.Kind)
	for _, kinds := range b.config.ManagedKinds {
		for _, kind := range kinds {
			cur, ok := internalKinds[kind.Kind()]
			if !ok {
				internalKinds[kind.Kind()] = kind
				continue
			}

			// Compare versions, set the latest to be the correct one in the map
			// string compare for now at least
			if strings.Compare(kind.Version(), cur.Version()) > 0 {
				internalKinds[kind.Kind()] = kind
			}
		}
	}
	for _, kind := range internalKinds {
		// Link this group to the internal representation.
		// This is used for server-side-apply (PATCH), and avoids the error:
		// "no kind is registered for the type"
		gvInternal := schema.GroupVersion{
			Group:   kind.Group(),
			Version: runtime.APIVersionInternal,
		}
		scheme.AddKnownTypeWithName(gvInternal.WithKind(kind.Kind()), kind.ZeroValue())
		scheme.AddKnownTypeWithName(gvInternal.WithKind(kind.Kind()+"List"), kind.ZeroListValue())
	}
	for _, kinds := range b.config.ManagedKinds {
		for _, kind := range kinds {
			scheme.AddKnownTypeWithName(kind.GroupVersionKind(), kind.ZeroValue())
			scheme.AddKnownTypeWithName(kind.GroupVersionKind().GroupVersion().WithKind(kind.Kind()+"List"), kind.ZeroListValue())
			if internal, ok := internalKinds[kind.Kind()]; ok {
				scheme.AddConversionFunc(kind.ZeroValue(), internal.ZeroValue(), b.conversionFuncFactory(kind, internal))
				scheme.AddConversionFunc(internal.ZeroValue(), kind.ZeroValue(), b.conversionFuncFactory(internal, kind))
			}
		}
	}
	return scheme.SetVersionPriority(b.GetGroupVersions()...)
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

func (b *appBuilder) conversionFuncFactory(source resource.Kind, target resource.Kind) conversion.ConversionFunc {
	return conversion.ConversionFunc(func(in, out interface{}, s conversion.Scope) error {
		raw := bytes.NewBuffer(nil)
		if err := source.Codecs[resource.KindEncodingJSON].Write(raw, in.(resource.Object)); err != nil {
			return err
		}
		converted, err := b.app.Convert(context.Background(), app.ConversionRequest{
			SourceGVK: source.GroupVersionKind(),
			TargetGVK: target.GroupVersionKind(),
			Raw:       app.RawObject{Raw: raw.Bytes(), Encoding: resource.KindEncodingJSON},
		})
		if err != nil {
			return err
		}
		return target.Codecs[resource.KindEncodingJSON].Read(bytes.NewReader(converted.Raw), out.(resource.Object))
	})
}
