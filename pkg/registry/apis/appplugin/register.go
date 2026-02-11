package appplugin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/open-feature/go-sdk/openfeature"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/sources"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	pluginaccesscontrol "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

var (
	_ builder.APIGroupBuilder        = (*AppPluginAPIBuilder)(nil)
	_ builder.APIGroupVersionProvider = (*AppPluginAPIBuilder)(nil)
	_ builder.APIGroupRouteProvider  = (*AppPluginAPIBuilder)(nil)
	_ builder.OpenAPIPostProcessor   = (*AppPluginAPIBuilder)(nil)
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
			// accessChecker is nil in the monolith; the aggregator's handler chain
			// already enforces authorization before requests reach this handler.
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
	// A noop connector is required so k8s registers this API group in discovery.
	// The real endpoint is provided via GetAPIRoutes.
	storage := map[string]rest.Storage{}
	storage["noop"] = &noopConnector{}
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

func (b *AppPluginAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	// Remove the noop connector from the OpenAPI spec.
	delete(oas.Paths.Paths, "/apis/"+b.groupVersion.String()+"/namespaces/{namespace}/noop/{name}")
	return oas, nil
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

// settingsHandler implements GET /apis/{group}/v0alpha1/namespaces/{ns}/settings
// It mirrors the behaviour of the legacy GET /api/plugins/:pluginId/settings endpoint.
func (b *AppPluginAPIBuilder) settingsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Extract org ID from namespace (populated by go-restful via mux vars).
	ns := mux.Vars(r)["namespace"]
	nsInfo, err := claims.ParseNamespace(ns)
	if err != nil {
		http.Error(w, "invalid namespace", http.StatusBadRequest)
		return
	}
	orgID := nsInfo.OrgID

	// Authorize the caller using the same permission as the legacy endpoint:
	//   ac.EvalPermission(pluginaccesscontrol.ActionAppAccess, plugins:id:<pluginID>)
	if b.accessControl != nil {
		user, err := identity.GetRequester(ctx)
		if err != nil {
			http.Error(w, "unauthenticated", http.StatusUnauthorized)
			return
		}
		scope := pluginaccesscontrol.ScopeProvider.GetResourceScope(b.pluginID)
		ok, err := b.accessControl.Evaluate(ctx, user, ac.EvalPermission(pluginaccesscontrol.ActionAppAccess, scope))
		if err != nil {
			http.Error(w, "authorization check failed", http.StatusInternalServerError)
			return
		}
		if !ok {
			http.Error(w, "access denied", http.StatusForbidden)
			return
		}
	}

	plugin, exists := b.pluginStore.Plugin(ctx, b.pluginID)
	if !exists {
		http.Error(w, "plugin not found", http.StatusNotFound)
		return
	}

	dto := &dtos.PluginSetting{
		Name:             plugin.Name,
		Type:             string(plugin.Type),
		Id:               plugin.ID,
		Enabled:          plugin.AutoEnabled,
		Pinned:           plugin.AutoEnabled,
		AutoEnabled:      plugin.AutoEnabled,
		Module:           plugin.Module,
		BaseUrl:          plugin.BaseURL,
		Info:             plugin.Info,
		Includes:         plugin.Includes,
		Dependencies:     plugin.Dependencies,
		DefaultNavUrl:    plugin.DefaultNavURL,
		State:            plugin.State,
		Signature:        plugin.Signature,
		SignatureType:    plugin.SignatureType,
		SignatureOrg:     plugin.SignatureOrg,
		SecureJsonFields: map[string]bool{},
		AngularDetected:  plugin.Angular.Detected,
	}

	ps, err := b.pluginSettings.GetPluginSettingByPluginID(ctx, &pluginsettings.GetByPluginIDArgs{
		PluginID: b.pluginID,
		OrgID:    orgID,
	})
	if err != nil {
		if !errors.Is(err, pluginsettings.ErrPluginSettingNotFound) {
			http.Error(w, "failed to get plugin settings", http.StatusInternalServerError)
			return
		}
	} else {
		dto.Enabled = ps.Enabled
		dto.Pinned = ps.Pinned
		dto.JsonData = ps.JSONData

		secureFields := map[string]bool{}
		for k, v := range ps.SecureJSONData {
			secureFields[k] = len(v) > 0
		}
		dto.SecureJsonFields = secureFields
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(dto); err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
	}
}

// ---- noop connector (required by k8s to register the API group) ----

type noopConnector struct{}

var (
	_ rest.Connecter            = (*noopConnector)(nil)
	_ rest.StorageMetadata      = (*noopConnector)(nil)
	_ rest.Scoper               = (*noopConnector)(nil)
	_ rest.SingularNameProvider = (*noopConnector)(nil)
)

func (r *noopConnector) New() runtime.Object                                        { return &metav1.Status{} }
func (r *noopConnector) NamespaceScoped() bool                                      { return true }
func (r *noopConnector) GetSingularName() string                                    { return "noop" }
func (r *noopConnector) Destroy()                                                   {}
func (r *noopConnector) ConnectMethods() []string                                   { return []string{"GET"} }
func (r *noopConnector) NewConnectOptions() (runtime.Object, bool, string)          { return nil, false, "" }
func (r *noopConnector) ProducesMIMETypes(verb string) []string                     { return nil }
func (r *noopConnector) ProducesObject(verb string) interface{}                     { return r.New() }

func (r *noopConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		_, _ = w.Write([]byte("NOOP"))
	}), nil
}
