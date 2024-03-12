package datasource

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/schemabuilder"
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
	"k8s.io/kube-openapi/pkg/validation/spec"
	"k8s.io/utils/strings/slices"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	datasource "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/builder"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

const QueryRequestSchemaKey = "QueryRequestSchema"
const QueryPayloadSchemaKey = "QueryPayloadSchema"

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
	datasources PluginDatasourceProvider,
	contextProvider PluginContextWrapper,
	pluginStore pluginstore.Store,
	accessControl accesscontrol.AccessControl,
) (*DataSourceAPIBuilder, error) {
	// This requires devmode!
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil, nil // skip registration unless opting into experimental apis
	}

	var err error
	var builder *DataSourceAPIBuilder
	all := pluginStore.Plugins(context.Background(), plugins.TypeDataSource)
	ids := []string{
		"grafana-testdata-datasource",
		//	"prometheus",
	}

	for _, ds := range all {
		if !slices.Contains(ids, ds.ID) {
			continue // skip this one
		}

		builder, err = NewDataSourceAPIBuilder(ds.JSONData,
			pluginClient,
			datasources,
			contextProvider,
			accessControl,
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
	accessControl accesscontrol.AccessControl) (*DataSourceAPIBuilder, error) {
	ri, err := resourceFromPluginID(plugin.ID)
	if err != nil {
		return nil, err
	}

	return &DataSourceAPIBuilder{
		connectionResourceInfo: ri,
		pluginJSON:             plugin,
		client:                 client,
		datasources:            datasources,
		contextProvider:        contextProvider,
		accessControl:          accessControl,
	}, nil
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
	_ bool,
) (*genericapiserver.APIGroupInfo, error) {
	storage := map[string]rest.Storage{}

	conn := b.connectionResourceInfo
	storage[conn.StoragePath()] = &connectionAccess{
		pluginID:     b.pluginJSON.ID,
		datasources:  b.datasources,
		resourceInfo: conn,
		tableConverter: utils.NewTableConverter(
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

	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(
		conn.GroupResource().Group, scheme,
		metav1.ParameterCodec, codecs)

	apiGroupInfo.VersionedResourcesStorageMap[conn.GroupVersion().Version] = storage
	return &apiGroupInfo, nil
}

func (b *DataSourceAPIBuilder) getPluginContext(ctx context.Context, uid string) (backend.PluginContext, error) {
	instance, err := b.datasources.GetInstanceSettings(ctx, b.pluginJSON.ID, uid)
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

	var err error
	opts := schemabuilder.QuerySchemaOptions{
		PluginID:   []string{b.pluginJSON.ID},
		QueryTypes: []data.QueryTypeDefinition{},
		Mode:       schemabuilder.SchemaTypeQueryPayload,
	}
	if b.pluginJSON.AliasIDs != nil {
		opts.PluginID = append(opts.PluginID, b.pluginJSON.AliasIDs...)
	}
	if b.queryTypes != nil {
		for _, qt := range b.queryTypes.Items {
			// The SDK type and api type are not the same so we recreate it here
			opts.QueryTypes = append(opts.QueryTypes, data.QueryTypeDefinition{
				ObjectMeta: data.ObjectMeta{
					Name: qt.Name,
				},
				Spec: qt.Spec,
			})
		}
	}
	oas.Components.Schemas[QueryPayloadSchemaKey], err = schemabuilder.GetQuerySchema(opts)
	if err != nil {
		return oas, err
	}
	opts.Mode = schemabuilder.SchemaTypeQueryRequest
	oas.Components.Schemas[QueryRequestSchemaKey], err = schemabuilder.GetQuerySchema(opts)
	if err != nil {
		return oas, err
	}

	// Update the request object
	sub := oas.Paths.Paths[root+"namespaces/{namespace}/connections/{name}/query"]
	if sub != nil && sub.Post != nil {
		sub.Post.Description = "Execute queries"
		sub.Post.RequestBody = &spec3.RequestBody{
			RequestBodyProps: spec3.RequestBodyProps{
				Required: true,
				Content: map[string]*spec3.MediaType{
					"application/json": {
						MediaTypeProps: spec3.MediaTypeProps{
							Schema:   spec.RefSchema("#/components/schemas/" + QueryRequestSchemaKey),
							Examples: getExamples(b.queryTypes),
						},
					},
				},
			},
		}
		okrsp, ok := sub.Post.Responses.StatusCodeResponses[200]
		if ok {
			sub.Post.Responses.StatusCodeResponses[http.StatusMultiStatus] = &spec3.Response{
				ResponseProps: spec3.ResponseProps{
					Description: "Query executed, but errors may exist in the datasource.  See the payload for more details.",
					Content:     okrsp.Content,
				},
			}
		}
	}

	// The root API discovery list
	sub = oas.Paths.Paths[root]
	if sub != nil && sub.Get != nil {
		sub.Get.Tags = []string{"API Discovery"} // sorts first in the list
	}
	return oas, err
}

// Register additional routes with the server
func (b *DataSourceAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return nil
}

func getExamples(queryTypes *query.QueryTypeDefinitionList) map[string]*spec3.Example {
	if queryTypes == nil {
		return nil
	}

	tr := data.TimeRange{From: "now-1h", To: "now"}
	examples := map[string]*spec3.Example{}
	for _, queryType := range queryTypes.Items {
		for idx, example := range queryType.Spec.Examples {
			q := data.NewDataQuery(example.SaveModel.Object)
			q.RefID = "A"
			for _, dis := range queryType.Spec.Discriminators {
				_ = q.Set(dis.Field, dis.Value)
			}
			if q.MaxDataPoints < 1 {
				q.MaxDataPoints = 1000
			}
			if q.IntervalMS < 1 {
				q.IntervalMS = 5000 // 5s
			}
			examples[fmt.Sprintf("%s-%d", example.Name, idx)] = &spec3.Example{
				ExampleProps: spec3.ExampleProps{
					Summary:     example.Name,
					Description: example.Description,
					Value: data.QueryDataRequest{
						TimeRange: tr,
						Queries:   []data.DataQuery{q},
					},
				},
			}
		}
	}
	return examples
}
