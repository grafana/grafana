package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"

	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	openapi "k8s.io/kube-openapi/pkg/common"
	"k8s.io/utils/strings/slices"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	queryV0 "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	"github.com/grafana/grafana/pkg/promlib/models"
	"github.com/grafana/grafana/pkg/registry/apis/query/queryschema"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource/kinds"
)

var (
	_ builder.APIGroupBuilder = (*DataSourceAPIBuilder)(nil)
)

// DataSourceAPIBuilder is used just so wire has something unique to return
type DataSourceAPIBuilder struct {
	datasourceResourceInfo utils.ResourceInfo

	pluginJSON           plugins.JSONData
	client               PluginClient // will only ever be called with the same plugin id!
	datasources          PluginDatasourceProvider
	contextProvider      PluginContextWrapper
	accessControl        accesscontrol.AccessControl
	queryTypes           *queryV0.QueryTypeDefinitionList
	configCrudUseNewApis bool
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
	// We want to expose just a limited set of plugins
	//nolint:staticcheck // not yet migrated to OpenFeature
	explicitPluginList := features.IsEnabledGlobally(featuremgmt.FlagDatasourceAPIServers)

	// This requires devmode!
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !explicitPluginList && !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil, nil // skip registration unless opting into experimental apis
	}

	var err error
	var builder *DataSourceAPIBuilder

	pluginJSONs, err := getDatasourcePlugins(pluginSources)
	if err != nil {
		return nil, fmt.Errorf("error getting list of datasource plugins: %s", err)
	}

	ids := []string{
		"grafana-testdata-datasource",
		"prometheus",
		"graphite",
	}

	for _, pluginJSON := range pluginJSONs {
		if explicitPluginList && !slices.Contains(ids, pluginJSON.ID) {
			continue // skip this one
		}

		if !pluginJSON.Backend {
			continue // skip frontend only plugins
		}

		if pluginJSON.Type != plugins.TypeDataSource {
			continue // skip non-datasource plugins
		}

		client, ok := pluginClient.(PluginClient)
		if !ok {
			return nil, fmt.Errorf("plugin client is not a PluginClient: %T", pluginClient)
		}

		builder, err = NewDataSourceAPIBuilder(pluginJSON,
			client,
			datasources.GetDatasourceProvider(pluginJSON),
			contextProvider,
			accessControl,
			//nolint:staticcheck // not yet migrated to OpenFeature
			features.IsEnabledGlobally(featuremgmt.FlagDatasourceQueryTypes),
			false,
		)
		if err != nil {
			return nil, err
		}

		apiRegistrar.RegisterAPI(builder)
	}
	return builder, nil // only used for wire
}

// PluginClient is a subset of the plugins.Client interface with only the
// functions supported (yet) by the datasource API
type PluginClient interface {
	backend.QueryDataHandler
	backend.CheckHealthHandler
	backend.CallResourceHandler
	backend.ConversionHandler
}

func NewDataSourceAPIBuilder(
	plugin plugins.JSONData,
	client PluginClient,
	datasources PluginDatasourceProvider,
	contextProvider PluginContextWrapper,
	accessControl accesscontrol.AccessControl,
	loadQueryTypes bool,
	configCrudUseNewApis bool,
) (*DataSourceAPIBuilder, error) {
	group, err := plugins.GetDatasourceGroupNameFromPluginID(plugin.ID)
	if err != nil {
		return nil, err
	}

	builder := &DataSourceAPIBuilder{
		datasourceResourceInfo: datasourceV0.DataSourceResourceInfo.WithGroupAndShortName(group, plugin.ID),
		pluginJSON:             plugin,
		client:                 client,
		datasources:            datasources,
		contextProvider:        contextProvider,
		accessControl:          accessControl,
		configCrudUseNewApis:   configCrudUseNewApis,
	}
	if loadQueryTypes {
		// In the future, this will somehow come from the plugin
		builder.queryTypes, err = getHardcodedQueryTypes(group)
	}
	return builder, err
}

// TODO -- somehow get the list from the plugin -- not hardcoded
func getHardcodedQueryTypes(group string) (*queryV0.QueryTypeDefinitionList, error) {
	var err error
	var raw json.RawMessage
	switch group {
	case "testdata.datasource.grafana.app":
		raw, err = kinds.QueryTypeDefinitionListJSON()
	case "prometheus.datasource.grafana.app":
		raw, err = models.QueryTypeDefinitionListJSON()
	}
	if err != nil {
		return nil, err
	}
	if raw != nil {
		types := &queryV0.QueryTypeDefinitionList{}
		err = json.Unmarshal(raw, types)
		return types, err
	}
	return nil, err
}

func (b *DataSourceAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.datasourceResourceInfo.GroupVersion()
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&datasourceV0.DataSource{},
		&datasourceV0.DataSourceList{},
		&datasourceV0.HealthCheckResult{},
		&unstructured.Unstructured{},

		// Query handler
		&queryV0.QueryDataRequest{},
		&queryV0.QueryDataResponse{},
		&queryV0.QueryTypeDefinition{},
		&queryV0.QueryTypeDefinitionList{},
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
	storage := map[string]rest.Storage{}

	// Register the raw datasource connection
	ds := b.datasourceResourceInfo
	storage[ds.StoragePath("query")] = &subQueryREST{builder: b}
	storage[ds.StoragePath("health")] = &subHealthREST{builder: b}
	storage[ds.StoragePath("resource")] = &subResourceREST{builder: b}

	// FIXME: temporarily register both "datasources" and "connections" query paths
	// This lets us deploy both datasources/{uid}/query and connections/{uid}/query
	// while we transition requests to the new path
	storage["connections"] = &noopREST{}                            // hidden from openapi
	storage["connections/query"] = storage[ds.StoragePath("query")] // deprecated in openapi

	if b.configCrudUseNewApis {
		legacyStore := &legacyStorage{
			datasources:  b.datasources,
			resourceInfo: &ds,
		}
		unified, err := grafanaregistry.NewRegistryStore(opts.Scheme, ds, opts.OptsGetter)
		if err != nil {
			return err
		}
		storage[ds.StoragePath()], err = opts.DualWriteBuilder(ds.GroupResource(), legacyStore, unified)
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

	// Register hardcoded query schemas
	err := queryschema.RegisterQueryTypes(b.queryTypes, storage)
	if err != nil {
		return err
	}

	registerQueryConvert(b.client, b.contextProvider, storage)

	apiGroupInfo.VersionedResourcesStorageMap[ds.GroupVersion().Version] = storage
	return err
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
		defs := queryV0.GetOpenAPIDefinitions(ref) // required when running standalone
		maps.Copy(defs, datasourceV0.GetOpenAPIDefinitions(ref))
		return defs
	}
}

func getDatasourcePlugins(pluginSources sources.Registry) ([]plugins.JSONData, error) {
	var pluginJSONs []plugins.JSONData

	// It's possible that the same plugin will be found in different sources.
	// Registering the same plugin twice in the API is Probably A Bad Thing,
	// so this map keeps track of uniques, so we can skip duplicates.
	var uniquePlugins = map[string]bool{}

	for _, pluginSource := range pluginSources.List(context.Background()) {
		res, err := pluginSource.Discover(context.Background())
		if err != nil {
			return nil, err
		}
		for _, p := range res {
			if p.Primary.JSONData.Type == plugins.TypeDataSource {
				if _, found := uniquePlugins[p.Primary.JSONData.ID]; found {
					backend.Logger.Info("Found duplicate plugin %s when registering API groups.", p.Primary.JSONData.ID)
					continue
				}
				uniquePlugins[p.Primary.JSONData.ID] = true
				pluginJSONs = append(pluginJSONs, p.Primary.JSONData)
			}
		}
	}
	return pluginJSONs, nil
}
