package datasource

import (
	"context"
	"errors"
	"fmt"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	openapi "k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	pluginspec "github.com/grafana/grafana/pkg/plugins/openapi"
	"github.com/grafana/grafana/pkg/registry/apis/query/queryschema"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

var (
	_ builder.APIGroupBuilder = (*DataSourceAPIBuilder)(nil)
)

type DataSourceAPIBuilderConfig struct {
	LoadQueryTypes         bool
	LoadOpenAPISpec        bool
	UseDualWriter          bool
	EnableResourceEndpoint bool
	EnableHealthEndpoint   bool
}

// DataSourceAPIBuilder is used just so wire has something unique to return
type DataSourceAPIBuilder struct {
	datasourceResourceInfo utils.ResourceInfo
	pluginJSON             plugins.JSONData
	client                 PluginClient // will only ever be called with the same plugin id!
	datasources            PluginDatasourceProvider
	contextProvider        PluginContextWrapper
	accessControl          accesscontrol.AccessControl
	schemas                map[string]*pluginschema.PluginSchema
	queryTypes             *datasourceV0.QueryTypeDefinitionList
	cfg                    DataSourceAPIBuilderConfig
	dataSourceCRUDMetric   *prometheus.HistogramVec
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiRegistrar builder.APIRegistrar,
	pluginClient plugins.Client, // access to everything
	datasources ScopedPluginDatasourceProvider,
	contextProvider PluginContextWrapper,
	accessControl accesscontrol.AccessControl,
	reg prometheus.Registerer,
	pluginSources sources.Registry,
) (*DataSourceAPIBuilder, error) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !features.IsEnabledGlobally(featuremgmt.FlagDatasourceUseNewCRUDAPIs) {
		return nil, nil
	}

	//nolint:staticcheck // not yet migrated to OpenFeature
	flags := DataSourceAPIBuilderConfig{
		LoadQueryTypes:         features.IsEnabledGlobally(featuremgmt.FlagDatasourcesQueryTypes),
		LoadOpenAPISpec:        features.IsEnabledGlobally(featuremgmt.FlagDatasourcesLoadOpenAPI),
		UseDualWriter:          features.IsEnabledGlobally(featuremgmt.FlagDatasourceUseNewCRUDAPIs),
		EnableResourceEndpoint: features.IsEnabledGlobally(featuremgmt.FlagDatasourcesApiServerEnableResourceEndpoint),
		EnableHealthEndpoint:   features.IsEnabledGlobally(featuremgmt.FlagDatasourcesApiServerEnableHealthEndpoint),
	}

	var err error
	var builder *DataSourceAPIBuilder

	dataSourceCRUDMetric := metricutil.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: "grafana",
		Name:      "ds_config_handler_apis_requests_duration_seconds",
		Help:      "Duration of requests handled by new k8s style APIs datasource configuration handlers",
	}, []string{"handler"})
	regErr := metrics.ProvideRegisterer().Register(dataSourceCRUDMetric)
	if regErr != nil && !errors.As(regErr, &prometheus.AlreadyRegisteredError{}) {
		return nil, regErr
	}

	pluginInfos, err := pluginspec.LoadPlugins(context.Background(), pluginSources,
		func(jsonData plugins.JSONData) bool {
			return jsonData.Type == plugins.TypeDataSource
		}, flags.LoadOpenAPISpec || flags.LoadQueryTypes)

	if err != nil {
		return nil, fmt.Errorf("error getting list of datasource plugins: %s", err)
	}

	for _, plugin := range pluginInfos {
		client, ok := pluginClient.(PluginClient)
		if !ok {
			return nil, fmt.Errorf("plugin client is not a PluginClient: %T", pluginClient)
		}

		groupName := plugin.JSONData.ID + ".datasource.grafana.app"
		builder, err = NewDataSourceAPIBuilder(
			groupName,
			plugin.JSONData,
			client,
			datasources.GetDatasourceProvider(plugin.JSONData),
			contextProvider,
			accessControl,
			flags,
		)
		if err != nil {
			return nil, err
		}

		builder.SetDataSourceCRUDMetrics(dataSourceCRUDMetric)

		// Register the openapi and query types
		builder.schemas = plugin.Schemas

		apiRegistrar.RegisterAPI(builder)
	}
	return builder, nil // only used for wire
}

// PluginClient is a subset of the plugins.Client interface with only the
// functions supported (yet) by the datasource API
type PluginClient interface {
	backend.QueryDataHandler
	backend.QueryChunkedDataHandler
	backend.CheckHealthHandler
	backend.CallResourceHandler
	backend.ConversionHandler
}

func NewDataSourceAPIBuilder(
	groupName string,
	plugin plugins.JSONData,
	client PluginClient,
	datasources PluginDatasourceProvider,
	contextProvider PluginContextWrapper,
	accessControl accesscontrol.AccessControl,
	cfg DataSourceAPIBuilderConfig,
) (*DataSourceAPIBuilder, error) {
	registerSubresourceMetrics(prometheus.DefaultRegisterer)

	builder := &DataSourceAPIBuilder{
		datasourceResourceInfo: datasourceV0.DataSourceResourceInfo.WithGroupAndShortName(groupName, plugin.ID),
		pluginJSON:             plugin,
		client:                 client,
		datasources:            datasources,
		contextProvider:        contextProvider,
		accessControl:          accessControl,
		cfg:                    cfg,
	}
	return builder, nil
}

func (b *DataSourceAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.datasourceResourceInfo.GroupVersion()
}

func (b *DataSourceAPIBuilder) SetDataSourceCRUDMetrics(datasourceCRUDMetric *prometheus.HistogramVec) {
	b.dataSourceCRUDMetric = datasourceCRUDMetric
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&datasourceV0.DataSource{},
		&datasourceV0.DataSourceList{},
		&datasourceV0.HealthCheckResult{},
		&unstructured.Unstructured{},
		&datasourceV0.DatasourceAccessInfo{},

		// Query handler
		&datasourceV0.QueryDataRequest{},
		&datasourceV0.QueryDataResponse{},
		&datasourceV0.QueryTypeDefinition{},
		&datasourceV0.QueryTypeDefinitionList{},
		&metav1.Status{},
	)
}

func (b *DataSourceAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := b.datasourceResourceInfo.GroupVersion()
	addKnownTypes(scheme, gv)

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	//   "no kind is registered for the type"
	addKnownTypes(scheme, schema.GroupVersion{
		Group:   gv.Group,
		Version: runtime.APIVersionInternal,
	})

	// If multiple versions exist, then register conversions from zz_generated.conversion.go
	// if err := playlist.RegisterConversions(scheme); err != nil {
	//   return err
	// }
	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (b *DataSourceAPIBuilder) AllowedV0Alpha1Resources() []string {
	return []string{builder.AllResourcesAllowed}
}

func (b *DataSourceAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	if opts.StorageOptsRegister != nil {
		opts.StorageOptsRegister(b.datasourceResourceInfo.GroupResource(), apistore.StorageOptions{
			EnableFolderSupport: false,

			// Setting the schema explicitly will force the apistore to explicitly marshal with a matching Group+version
			// This is required because we map the same go type (DataSourceConfig) across multiple api groups
			// and the default k8s codec will pick the first one registered, regardless which group is set
			// See: https://github.com/kubernetes/kubernetes/blob/v1.34.3/staging/src/k8s.io/apimachinery/pkg/runtime/serializer/versioning/versioning.go#L267
			Scheme: opts.Scheme,
		})
	}

	storage := map[string]rest.Storage{}

	// Register the raw datasource connection
	ds := b.datasourceResourceInfo
	storage[ds.StoragePath("query")] = &subQueryREST{builder: b}

	if b.cfg.EnableResourceEndpoint {
		storage[ds.StoragePath("resources")] = &subResourceREST{builder: b}
	}

	if b.cfg.EnableHealthEndpoint {
		storage[ds.StoragePath("health")] = &subHealthREST{builder: b}
	}

	if b.cfg.UseDualWriter {
		b.applyDefaultStorageConfig(opts, ds)
		legacyStore := &legacyStorage{
			datasources:                     b.datasources,
			resourceInfo:                    &ds,
			dsConfigHandlerRequestsDuration: b.dataSourceCRUDMetric,
		}
		unified, err := grafanaregistry.NewRegistryStore(opts.Scheme, ds, opts.OptsGetter)
		if err != nil {
			return err
		}
		storage[ds.StoragePath()], err = opts.DualWriteBuilder(ds.GroupResource(), legacyStore, unified)
		storage[ds.StoragePath("access")] = &subAccessREST{
			builder: b,
			getter:  legacyStore,
		}
		if err != nil {
			return err
		}
	} else {
		storage[ds.StoragePath()] = &connectionAccess{
			datasources:    b.datasources,
			resourceInfo:   ds,
			tableConverter: ds.TableConverter(),
		}
	}

	// Frontend proxy
	if len(b.pluginJSON.Routes) > 0 {
		storage[ds.StoragePath("proxy")] = &subProxyREST{pluginJSON: b.pluginJSON}
	}

	// Register query types (convert to real k8s type first)
	if b.cfg.LoadQueryTypes && b.schemas != nil {
		found := b.schemas[ds.GroupVersion().Version]
		if found != nil && found.QueryTypes != nil {
			b.queryTypes = &datasourceV0.QueryTypeDefinitionList{
				ListMeta: metav1.ListMeta{
					ResourceVersion: found.QueryTypes.ResourceVersion,
				},
				Items: make([]datasourceV0.QueryTypeDefinition, 0, len(found.QueryTypes.Items)),
			}
			for _, qt := range found.QueryTypes.Items {
				b.queryTypes.Items = append(b.queryTypes.Items, datasourceV0.QueryTypeDefinition{
					ObjectMeta: metav1.ObjectMeta{
						Name:            qt.Name,
						ResourceVersion: qt.ResourceVersion,
					},
					Spec: qt.Spec,
				})
			}
			if err := queryschema.RegisterQueryTypes(b.queryTypes, storage); err != nil {
				return err
			}
		}
	}

	registerQueryConvert(b.client, b.contextProvider, storage)

	apiGroupInfo.VersionedResourcesStorageMap[ds.GroupVersion().Version] = storage
	return nil
}

// applyDefaultStorageConfig injects a unified storage config entry for this plugin's
// datasource resource when no plugin-specific config exists, copying from the shared
// "all datasources" key (setting.DataSourceResources). This allows operators to set a
// single DualWriter mode for every datasource plugin via:
//
//	[unified_storage.datasources.datasource.grafana.app]
//	dualWriterMode = 1
func (b *DataSourceAPIBuilder) applyDefaultStorageConfig(opts builder.APIGroupOptions, ri utils.ResourceInfo) {
	if opts.StorageOpts == nil {
		return
	}
	key := ri.GroupResource().String()
	if _, exists := opts.StorageOpts.UnifiedStorageConfig[key]; exists {
		return
	}
	fallback, hasFallback := opts.StorageOpts.UnifiedStorageConfig[setting.DataSourceResources]
	if !hasFallback {
		return
	}
	opts.StorageOpts.UnifiedStorageConfig[key] = setting.UnifiedStorageConfig{
		DualWriterMode: fallback.DualWriterMode,
	}
}

func (b *DataSourceAPIBuilder) getPluginContext(ctx context.Context, uid string) (backend.PluginContext, error) {
	instance, err := b.datasources.GetInstanceSettings(ctx, uid)
	if err != nil {
		return backend.PluginContext{}, err
	}
	return b.contextProvider.PluginContextForDataSource(ctx, instance)
}

func (b *DataSourceAPIBuilder) GetOpenAPIDefinitions() openapi.GetOpenAPIDefinitions {
	return func(ref openapi.ReferenceCallback) map[string]openapi.OpenAPIDefinition {
		return datasourceV0.GetOpenAPIDefinitions(ref)
	}
}
