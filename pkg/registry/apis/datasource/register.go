package datasource

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/utils/strings/slices"

	"github.com/grafana/grafana/pkg/apis"
	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/utils"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

var _ grafanaapiserver.APIGroupBuilder = (*DSAPIBuilder)(nil)

// This is used just so wire has something unique to return
type DSAPIBuilder struct {
	connectionResourceInfo apis.ResourceInfo
	configResourceInfo     apis.ResourceInfo

	plugin          pluginstore.Plugin
	client          plugins.Client
	dsService       datasources.DataSourceService
	dataSourceCache datasources.CacheService
	namespacer      request.NamespaceMapper
}

func RegisterAPIService(
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	apiregistration grafanaapiserver.APIRegistrar,
	pluginClient plugins.Client,
	pluginStore pluginstore.Store,
	dsService datasources.DataSourceService,
	dataSourceCache datasources.CacheService,
) *DSAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}

	var builder *DSAPIBuilder
	all := pluginStore.Plugins(context.Background(), plugins.TypeDataSource)
	ids := []string{
		"grafana-testdata-datasource",
		"grafana-postgresql-datasource",
		"prometheus", // has proxy routes!
	}

	for _, ds := range all {
		if !slices.Contains(ids, ds.ID) {
			continue // skip this one
		}

		group := getDatasourceGroupNameFromPluginID(ds.ID)
		builder = &DSAPIBuilder{
			connectionResourceInfo: v0alpha1.GenericConnectionResourceInfo.WithGroupAndShortName(group, ds.ID+"-conn"),
			configResourceInfo:     v0alpha1.GenericConfigResourceInfo.WithGroupAndShortName(group, ds.ID),
			plugin:                 ds,
			client:                 pluginClient,
			dsService:              dsService,
			dataSourceCache:        dataSourceCache,
			namespacer:             request.GetNamespaceMapper(cfg),
		}
		apiregistration.RegisterAPI(builder)
	}
	return builder // only used for wire
}

func (b *DSAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.connectionResourceInfo.GroupVersion()
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&v0alpha1.DataSourceConnection{},
		&v0alpha1.DataSourceConnectionList{},
		&v0alpha1.HealthCheckResult{},
		&v0alpha1.DataSourceConfig{},
		&v0alpha1.DataSourceConfigList{},
		// Added for subresource hack
		&metav1.Status{},
	)
}

func (b *DSAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
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

func (b *DSAPIBuilder) GetAPIGroupInfo(
	scheme *runtime.Scheme,
	codecs serializer.CodecFactory, // pointer?
	optsGetter generic.RESTOptionsGetter,
) (*genericapiserver.APIGroupInfo, error) {
	storage := map[string]rest.Storage{}
	if true { // TODO? additional feature flag for configs since this is way less mature/handwavy
		config := b.configResourceInfo
		storage[config.StoragePath()] = &configAccess{
			builder:      b,
			resourceInfo: config,
			tableConverter: utils.NewTableConverter(
				config.GroupResource(),
				// NOTE: interesting fields will depend on the datasource type!
				[]metav1.TableColumnDefinition{
					{Name: "Name", Type: "string", Format: "name"},
					{Name: "Title", Type: "string", Format: "string", Description: "The datasource title"},
					{Name: "APIVersion", Type: "string", Format: "string", Description: "API Version"},
					{Name: "Created At", Type: "date"},
				},
				func(obj any) ([]interface{}, error) {
					m, ok := obj.(*v0alpha1.DataSourceConfig)
					if !ok {
						return nil, fmt.Errorf("expected connection")
					}
					return []interface{}{
						m.Name,
						m.Spec.Name,
						m.APIVersion,
						m.CreationTimestamp.UTC().Format(time.RFC3339),
					}, nil
				},
			),
		}
	}

	conn := b.connectionResourceInfo
	storage[conn.StoragePath()] = &connectionAccess{
		builder:      b,
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
				m, ok := obj.(*v0alpha1.DataSourceConnection)
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
	if len(b.plugin.Routes) > 0 {
		storage[conn.StoragePath("proxy")] = &subProxyREST{builder: b}
	}

	apiGroupInfo := genericapiserver.NewDefaultAPIGroupInfo(
		conn.GroupResource().Group, scheme,
		metav1.ParameterCodec, codecs)

	apiGroupInfo.VersionedResourcesStorageMap[conn.GroupVersion().Version] = storage
	return &apiGroupInfo, nil
}

func (b *DSAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v0alpha1.GetOpenAPIDefinitions
}

// Register additional routes with the server
func (b *DSAPIBuilder) GetAPIRoutes() *grafanaapiserver.APIRoutes {
	return nil
}

func (b *DSAPIBuilder) getDataSourcePluginContext(ctx context.Context, name string) (*backend.PluginContext, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}
	ds, err := b.dataSourceCache.GetDatasourceByUID(ctx, name, user, false)
	if err != nil {
		return nil, err
	}

	settings := backend.DataSourceInstanceSettings{}
	settings.ID = ds.ID
	settings.UID = ds.UID
	settings.Name = ds.Name
	settings.URL = ds.URL
	settings.Updated = ds.Updated
	settings.User = ds.User
	settings.JSONData, err = ds.JsonData.ToDB()
	if err != nil {
		return nil, err
	}

	settings.DecryptedSecureJSONData, err = b.dsService.DecryptedValues(ctx, ds)
	if err != nil {
		return nil, err
	}
	return &backend.PluginContext{
		OrgID:                      info.OrgID,
		PluginID:                   b.plugin.ID,
		PluginVersion:              b.plugin.Info.Version,
		User:                       &backend.User{},
		AppInstanceSettings:        &backend.AppInstanceSettings{},
		DataSourceInstanceSettings: &settings,
	}, nil
}

func (b *DSAPIBuilder) getDataSource(ctx context.Context, name string) (*datasources.DataSource, error) {
	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}
	return b.dataSourceCache.GetDatasourceByUID(ctx, name, user, false)
}

func (b *DSAPIBuilder) getDataSources(ctx context.Context) ([]*datasources.DataSource, error) {
	orgId, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	return b.dsService.GetDataSourcesByType(ctx, &datasources.GetDataSourcesByTypeQuery{
		OrgID: orgId,
		Type:  b.plugin.ID,
	})
}
