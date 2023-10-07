package v0alpha1

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/grafana-apiserver"
	grafanarequest "github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/utils/strings/slices"
)

const VersionID = "v0alpha1" //

var _ grafanaapiserver.APIGroupBuilder = (*DSAPIBuilder)(nil)

// This is used just so wire has something unique to return
type DSAPIBuilder struct {
	groupVersion schema.GroupVersion
	apiVersion   string

	plugin    pluginstore.Plugin
	client    plugins.Client
	dsService datasources.DataSourceService
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration grafanaapiserver.APIRegistrar,
	pluginClient plugins.Client,
	pluginStore pluginstore.Store,
	dsService datasources.DataSourceService,
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
			groupVersion: groupVersion,
			apiVersion:   groupVersion.String(),
			plugin:       ds,
			client:       pluginClient,
			dsService:    dsService,
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
		&DataSourceConfig{},
		&DataSourceConfigList{},
		&InstanceInfo{},
		&InstanceInfoList{},
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
	return getOpenAPIDefinitions
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
				{Path: "/route",
					Spec: &spec3.PathProps{
						Summary:     "generic resource call...",
						Description: "TODO... check that this is actually implemented",
						Get:         &spec3.Operation{},
						Post:        &spec3.Operation{},
					},
					Handler: b.doSubresource,
				},
				{Path: "/route/*",
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
	orgId, ok := grafanarequest.OrgIDFrom(ctx)
	if !ok {
		orgId = 1 // TODO: default org ID 1 for now
	}
	return b.dsService.GetDataSource(ctx, &datasources.GetDataSourceQuery{
		OrgID: orgId,
		UID:   name,
	})
}

func (b *DSAPIBuilder) getDataSources(ctx context.Context) ([]*datasources.DataSource, error) {
	orgId, ok := grafanarequest.OrgIDFrom(ctx)
	if !ok {
		orgId = 1 // TODO: default org ID 1 for now
	}

	vals, err := b.dsService.GetDataSourcesByType(ctx, &datasources.GetDataSourcesByTypeQuery{
		OrgID: orgId,
		Type:  b.plugin.ID,
	})
	// HACK!!! See https://github.com/grafana/grafana/issues/76154
	if err == nil && len(vals) == 0 && len(b.plugin.AliasIDs) > 0 {
		vals, err = b.dsService.GetDataSourcesByType(ctx, &datasources.GetDataSourcesByTypeQuery{
			OrgID: orgId,
			Type:  b.plugin.AliasIDs[0], // "testdata",
		})
	}
	return vals, err
}

// Authz should already be applied!!!
func (b *DSAPIBuilder) doSubresource(w http.ResponseWriter, r *http.Request) {
	info, ok := request.RequestInfoFrom(r.Context())
	if !ok {
		fmt.Printf("ERROR!!!!")
		return
	}
	orgId, ok := grafanarequest.ParseOrgID(info.Namespace)
	if !ok {
		fmt.Printf("bad org")
		return
	}

	ctx := r.Context()
	ds, err := b.dsService.GetDataSource(ctx, &datasources.GetDataSourceQuery{
		OrgID: orgId,
		UID:   info.Name,
	})
	if err != nil {
		fmt.Printf("ERROR!!!! %v", err)
		return
	}
	if ds == nil {
		fmt.Printf("ERROR!!!! %v", ds)
		return
	}

	switch info.Subresource {
	case "query":
		_, _ = w.Write([]byte("DO QUERY!"))
	case "health":
		_, _ = w.Write([]byte("DO Health"))
	default:
		out, _ := json.MarshalIndent(ds, "", "  ")
		_, _ = w.Write(out)
	}

}
