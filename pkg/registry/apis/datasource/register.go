package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	openapi "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/utils/strings/slices"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	datasource "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/promlib/models"
	"github.com/grafana/grafana/pkg/registry/apis/query/queryschema"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource/kinds"
)

var _ builder.APIGroupBuilder = (*DataSourceAPIBuilder)(nil)

// DataSourceAPIBuilder is used just so wire has something unique to return
type DataSourceAPIBuilder struct {
	connectionResourceInfo common.ResourceInfo

	pluginJSON      plugins.JSONData
	client          PluginClient // will only ever be called with the same pluginid!
	datasources     PluginDatasourceProvider
	contextProvider PluginContextWrapper
	accessControl   accesscontrol.AccessControl
	queryTypes      *query.QueryTypeDefinitionList
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiRegistrar builder.APIRegistrar,
	pluginClient plugins.Client, // access to everything
	datasources ScopedPluginDatasourceProvider,
	contextProvider PluginContextWrapper,
	pluginStore pluginstore.Store,
	accessControl accesscontrol.AccessControl,
	reg prometheus.Registerer,
) (*DataSourceAPIBuilder, error) {
	// This requires devmode!
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil, nil // skip registration unless opting into experimental apis
	}

	var err error
	var builder *DataSourceAPIBuilder
	all := pluginStore.Plugins(context.Background(), plugins.TypeDataSource)
	// ATTENTION: Adding a datasource here requires the plugin to implement
	// an AdmissionHandler to validate the datasource settings.
	ids := []string{
		"grafana-testdata-datasource",
		"prometheus",
		"graphite",
	}

	for _, ds := range all {
		if !slices.Contains(ids, ds.ID) {
			continue // skip this one
		}

		builder, err = NewDataSourceAPIBuilder(ds.JSONData,
			pluginClient,
			datasources.GetDatasourceProvider(ds.JSONData),
			contextProvider,
			accessControl,
			features.IsEnabledGlobally(featuremgmt.FlagDatasourceQueryTypes),
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
}

func NewDataSourceAPIBuilder(
	plugin plugins.JSONData,
	client PluginClient,
	datasources PluginDatasourceProvider,
	contextProvider PluginContextWrapper,
	accessControl accesscontrol.AccessControl,
	loadQueryTypes bool,
) (*DataSourceAPIBuilder, error) {
	ri, err := resourceFromPluginID(plugin.ID)
	if err != nil {
		return nil, err
	}

	builder := &DataSourceAPIBuilder{
		connectionResourceInfo: ri,
		pluginJSON:             plugin,
		client:                 client,
		datasources:            datasources,
		contextProvider:        contextProvider,
		accessControl:          accessControl,
	}
	if loadQueryTypes {
		// In the future, this will somehow come from the plugin
		builder.queryTypes, err = getHardcodedQueryTypes(ri.GroupResource().Group)
	}
	return builder, err
}

// TODO -- somehow get the list from the plugin -- not hardcoded
func getHardcodedQueryTypes(group string) (*query.QueryTypeDefinitionList, error) {
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
		types := &query.QueryTypeDefinitionList{}
		err = json.Unmarshal(raw, types)
		return types, err
	}
	return nil, err
}

func (b *DataSourceAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.connectionResourceInfo.GroupVersion()
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&datasource.DataSourceConnection{},
		&datasource.DataSourceConnectionList{},
		&datasource.HealthCheckResult{},
		&unstructured.Unstructured{},
		// Query handler
		&query.QueryDataRequest{},
		&query.QueryDataResponse{},
		&query.QueryTypeDefinition{},
		&query.QueryTypeDefinitionList{},
		&metav1.Status{},
	)
}

func (b *DataSourceAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := b.connectionResourceInfo.GroupVersion()
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

func resourceFromPluginID(pluginID string) (common.ResourceInfo, error) {
	group, err := plugins.GetDatasourceGroupNameFromPluginID(pluginID)
	if err != nil {
		return common.ResourceInfo{}, err
	}
	return datasource.GenericConnectionResourceInfo.WithGroupAndShortName(group, pluginID+"-connection"), nil
}

func (b *DataSourceAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	_ generic.RESTOptionsGetter,
	_ grafanarest.DualWriteBuilder,
) (*genericapiserver.APIGroupInfo, error) {
	storage := map[string]rest.Storage{}

	conn := b.connectionResourceInfo
	storage[conn.StoragePath()] = &connectionAccess{
		datasources:  b.datasources,
		resourceInfo: conn,
		tableConverter: gapiutil.NewTableConverter(
			conn.GroupResource(),
			[]metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Title", Type: "string", Format: "string", Description: "The datasource title"},
				{Name: "APIVersion", Type: "string", Format: "string", Description: "API Version"},
				{Name: "Created At", Type: "date"},
			},
			func(obj any) ([]interface{}, error) {
				m, ok := obj.(*datasource.DataSourceConnection)
				if !ok {
					return nil, fmt.Errorf("expected connection")
				}
				return []interface{}{
					m.Name,
					m.Title,
					m.APIVersion,
					m.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			},
		),
	}
	storage[conn.StoragePath("query")] = &subQueryREST{builder: b}
	storage[conn.StoragePath("health")] = &subHealthREST{builder: b}

	// TODO! only setup this endpoint if it is implemented
	storage[conn.StoragePath("resource")] = &subResourceREST{builder: b}

	// Frontend proxy
	if len(b.pluginJSON.Routes) > 0 {
		storage[conn.StoragePath("proxy")] = &subProxyREST{pluginJSON: b.pluginJSON}
	}

	// Register hardcoded query schemas
	err := queryschema.RegisterQueryTypes(b.queryTypes, storage)

	// Create the group info
	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(
		conn.GroupResource().Group, scheme,
		metav1.ParameterCodec, codecs)

	apiGroupInfo.VersionedResourcesStorageMap[conn.GroupVersion().Version] = storage
	return &apiGroupInfo, err
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
		defs := query.GetOpenAPIDefinitions(ref) // required when running standalone
		for k, v := range datasource.GetOpenAPIDefinitions(ref) {
			defs[k] = v
		}
		return defs
	}
}

func (b *DataSourceAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	// The plugin description
	oas.Info.Description = b.pluginJSON.Info.Description

	// The root api URL
	root := "/apis/" + b.connectionResourceInfo.GroupVersion().String() + "/"

	// Hide the ability to list all connections across tenants
	delete(oas.Paths.Paths, root+b.connectionResourceInfo.GroupResource().Resource)

	// Add queries to the request properties
	// Add queries to the request properties
	err := queryschema.AddQueriesToOpenAPI(queryschema.OASQueryOptions{
		Swagger:          oas,
		PluginJSON:       &b.pluginJSON,
		QueryTypes:       b.queryTypes,
		Root:             root,
		QueryPath:        "namespaces/{namespace}/connections/{name}/query",
		QueryDescription: fmt.Sprintf("Query the %s datasources", b.pluginJSON.Name),
	})

	// The root API discovery list
	sub := oas.Paths.Paths[root]
	if sub != nil && sub.Get != nil {
		sub.Get.Tags = []string{"API Discovery"} // sorts first in the list
	}
	return oas, err
}

// Register additional routes with the server
func (b *DataSourceAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil
}
