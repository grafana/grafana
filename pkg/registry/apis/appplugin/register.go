package appplugin

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

var (
	_ builder.APIGroupBuilder         = (*AppPluginAPIBuilder)(nil)
	_ builder.APIGroupVersionProvider = (*AppPluginAPIBuilder)(nil)
	_ builder.APIGroupRouteProvider   = (*AppPluginAPIBuilder)(nil)
)

const VERSION = "v0alpha1"

// AppPluginAPIBuilder builds an apiserver for a single app plugin.
type AppPluginAPIBuilder struct {
	pluginID       string
	groupVersion   schema.GroupVersion
	pluginStore    pluginstore.Store
	pluginSettings pluginsettings.Service
	accessControl  ac.AccessControl // optional; when nil the authz check is skipped (monolith delegates to its own middleware)
}

// NewAppPluginAPIBuilder creates a single AppPluginAPIBuilder for the given plugin ID.
// This is used by the standalone factory (factory.go) where plugin discovery isn't available.
func NewAppPluginAPIBuilder(
	pluginID string,
	pluginStore pluginstore.Store,
	pluginSettings pluginsettings.Service,
	accessControl ac.AccessControl,
) *AppPluginAPIBuilder {
	groupName := pluginID + ".app.grafana.app"
	return &AppPluginAPIBuilder{
		pluginID: pluginID,
		groupVersion: schema.GroupVersion{
			Group:   groupName,
			Version: VERSION,
		},
		pluginStore:    pluginStore,
		pluginSettings: pluginSettings,
		accessControl:  accessControl,
	}
}

func RegisterAPIService(
	apiRegistrar builder.APIRegistrar,
	pluginSources sources.Registry,
	pluginStore pluginstore.Store,
	pluginSettings pluginsettings.Service,
	accessControl ac.AccessControl,
) (*AppPluginAPIBuilder, error) {
	ctx := context.Background()
	if !openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagAppPluginAPIServer, false, openfeature.TransactionContext(ctx)) {
		return nil, nil
	}

	pluginJSONs, err := getAppPlugins(pluginSources)
	if err != nil {
		return nil, fmt.Errorf("error getting list of app plugins: %w", err)
	}

	var last *AppPluginAPIBuilder
	for _, pluginJSON := range pluginJSONs {
		groupName := pluginJSON.ID + ".app.grafana.app"
		b := &AppPluginAPIBuilder{
			pluginID: pluginJSON.ID,
			groupVersion: schema.GroupVersion{
				Group:   groupName,
				Version: VERSION,
			},
			pluginStore:    pluginStore,
			pluginSettings: pluginSettings,
			accessControl:  accessControl,
		}
		apiRegistrar.RegisterAPI(b)
		last = b
	}
	return last, nil // only used for wire
}

// getAppPlugins discovers all installed backend app plugins.
func getAppPlugins(pluginSources sources.Registry) ([]plugins.JSONData, error) {
	var pluginJSONs []plugins.JSONData
	uniquePlugins := map[string]bool{}

	for _, pluginSource := range pluginSources.List(context.Background()) {
		res, err := pluginSource.Discover(context.Background())
		if err != nil {
			return nil, err
		}
		for _, p := range res {
			if !p.Primary.JSONData.Backend || p.Primary.JSONData.Type != plugins.TypeApp {
				continue
			}

			if _, found := uniquePlugins[p.Primary.JSONData.ID]; found {
				backend.Logger.Info("Found duplicate app plugin %s when registering API groups.", p.Primary.JSONData.ID)
				continue
			}

			uniquePlugins[p.Primary.JSONData.ID] = true
			pluginJSONs = append(pluginJSONs, p.Primary.JSONData)
		}
	}
	return pluginJSONs, nil
}

func (b *AppPluginAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return b.groupVersion
}

func (b *AppPluginAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	metav1.AddToGroupVersion(scheme, b.groupVersion)
	scheme.AddKnownTypes(b.groupVersion, &metav1.Status{})
	return scheme.SetVersionPriority(b.groupVersion)
}

func (b *AppPluginAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	storage := map[string]rest.Storage{}
	apiGroupInfo.VersionedResourcesStorageMap[b.groupVersion.Version] = storage
	return nil
}

func (b *AppPluginAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return func(ref common.ReferenceCallback) map[string]common.OpenAPIDefinition {
		return map[string]common.OpenAPIDefinition{}
	}
}

func (b *AppPluginAPIBuilder) AllowedV0Alpha1Resources() []string {
	return []string{builder.AllResourcesAllowed}
}

// GetAPIRoutes registers the GET /settings namespace route.
func (b *AppPluginAPIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "settings",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Tags:        []string{"AppPluginSettings"},
							OperationId: "getAppPluginSettings",
							Description: "Returns the settings for this app plugin in the given namespace (org).",
							Parameters: []*spec3.Parameter{
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "namespace",
										In:          "path",
										Required:    true,
										Example:     "default",
										Description: "workspace",
										Schema:      spec.StringProperty(),
									},
								},
							},
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										200: {
											ResponseProps: spec3.ResponseProps{
												Description: "Plugin settings",
												Content: map[string]*spec3.MediaType{
													"application/json": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema: spec.MapProperty(nil),
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
				Handler: b.settingsHandler,
			},
		},
	}
}
