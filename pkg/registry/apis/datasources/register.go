package datasources

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/utils/strings/slices"

	"github.com/grafana/grafana/pkg/apis/datasources/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	grafanarequest "github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

const VersionID = "v0alpha1" //

var _ grafanaapiserver.APIGroupBuilder = (*DSAPIBuilder)(nil)

// This is used just so wire has something unique to return
type DSAPIBuilder struct {
	groupVersion schema.GroupVersion
	apiVersion   string

	plugin          pluginstore.Plugin
	client          plugins.Client
	dsService       datasources.DataSourceService
	dataSourceCache datasources.CacheService
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration grafanaapiserver.APIRegistrar,
	pluginClient plugins.Client,
	pluginStore pluginstore.Store,
	dsService datasources.DataSourceService,
	dataSourceCache datasources.CacheService,
) *DSAPIBuilder {
	if !features.IsEnabled(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}

	var builder *DSAPIBuilder
	all := pluginStore.Plugins(context.Background(), plugins.TypeDataSource)
	ids := []string{"grafana-testdata-datasource", "postgres"}

	for _, ds := range all {
		if !slices.Contains(ids, ds.ID) {
			continue // skip this one
		}

		groupVersion := schema.GroupVersion{
			Group:   fmt.Sprintf("%s.ds.grafana.com", ds.ID),
			Version: VersionID,
		}
		builder = &DSAPIBuilder{
			groupVersion:    groupVersion,
			apiVersion:      groupVersion.String(),
			plugin:          ds,
			client:          pluginClient,
			dsService:       dsService,
			dataSourceCache: dataSourceCache,
		}
		apiregistration.RegisterAPI(builder)
	}
	return builder // only used for wire
}

func (b *DSAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.groupVersion
}

func (b *DSAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(b.groupVersion,
		&v0alpha1.DataSourceConfig{},
		&v0alpha1.DataSourceConfigList{},
		&v0alpha1.InstanceInfo{},
		&v0alpha1.InstanceInfoList{},
	)
	metav1.AddToGroupVersion(scheme, b.groupVersion)
	return scheme.SetVersionPriority(b.groupVersion)
}

func (b *DSAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
) (*genericapiserver.APIGroupInfo, error) {
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(
		b.groupVersion.Group, scheme,
		metav1.ParameterCodec, codecs)
	storage := map[string]rest.Storage{}
	// instance is usage access
	storage["instance"] = &instanceStorage{
		builder:    b,
		apiVersion: b.apiVersion,
		groupResource: schema.GroupResource{
			Group:    b.groupVersion.Group,
			Resource: "instance",
		},
	}
	// config is for execution access
	storage["config"] = &configStorage{
		builder:    b,
		apiVersion: b.apiVersion,
		groupResource: schema.GroupResource{
			Group:    b.groupVersion.Group,
			Resource: "config",
		},
	}
	apiGroupInfo.VersionedResourcesStorageMap[VersionID] = storage
	return &apiGroupInfo, nil
}

func (b *DSAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v0alpha1.GetOpenAPIDefinitions
}

// Register additional routes with the server
func (b *DSAPIBuilder) GetAPIRoutes() *grafanaapiserver.APIRoutes {
	return &grafanaapiserver.APIRoutes{
		Resource: map[string][]grafanaapiserver.APIRouteHandler{
			"instance": {
				{Path: "/query",
					Spec: &spec3.PathProps{
						Summary:     "an example at the root level",
						Description: "longer description here?",
						Get: &spec3.Operation{
							OperationProps: spec3.OperationProps{
								Parameters: []*spec3.Parameter{
									{ParameterProps: spec3.ParameterProps{
										Name: "a",
									}},
								},
							},
						},
						Post: &spec3.Operation{
							OperationProps: spec3.OperationProps{
								Parameters: []*spec3.Parameter{
									{ParameterProps: spec3.ParameterProps{
										Name: "a",
									}},
								},
							},
						},
					},
					Handler: b.doSubresource,
				},
				{Path: "/health",
					Spec: &spec3.PathProps{
						Summary:     "an example at the root level",
						Description: "longer description here?",
						Get: &spec3.Operation{
							OperationProps: spec3.OperationProps{
								Parameters: []*spec3.Parameter{
									{ParameterProps: spec3.ParameterProps{
										Name: "a",
									}},
								},
							},
						},
					},
					Handler: b.doSubresource,
				},
				{Path: "/resource",
					Spec: &spec3.PathProps{
						Summary:     "generic resource call...",
						Description: "TODO... check that this is actually implemented",
						Get:         &spec3.Operation{},
						Post:        &spec3.Operation{},
					},
					Handler: b.doSubresource,
				},
				{Path: "/resource/{.*}",
					Spec: &spec3.PathProps{
						Summary:     "generic resource call...",
						Description: "TODO... check that this is actually implemented",
						Get:         &spec3.Operation{},
						Post:        &spec3.Operation{},
					},
					Handler: b.doSubresource,
				},
			},
		},
	}
}

func (b *DSAPIBuilder) getDataSource(ctx context.Context, name string) (*datasources.DataSource, error) {
	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}
	return b.dataSourceCache.GetDatasourceByUID(ctx, name, user, false)
}

func (b *DSAPIBuilder) getDataSources(ctx context.Context) ([]*datasources.DataSource, error) {
	info, err := grafanarequest.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	vals, err := b.dsService.GetDataSourcesByType(ctx, &datasources.GetDataSourcesByTypeQuery{
		OrgID: info.OrgID,
		Type:  b.plugin.ID,
	})
	// HACK!!! See https://github.com/grafana/grafana/issues/76154
	if err == nil && len(vals) == 0 && len(b.plugin.AliasIDs) > 0 {
		vals, err = b.dsService.GetDataSourcesByType(ctx, &datasources.GetDataSourcesByTypeQuery{
			OrgID: info.OrgID,
			Type:  b.plugin.AliasIDs[0], // "testdata",
		})
	}
	return vals, err
}
