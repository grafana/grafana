package dashboardsnapshot

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	dashboardsnapshot "github.com/grafana/grafana/pkg/apis/dashboardsnapshot/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errhttp"
	"github.com/grafana/grafana/pkg/web"
)

var (
	_ builder.APIGroupBuilder       = (*SnapshotsAPIBuilder)(nil)
	_ builder.OpenAPIPostProcessor  = (*SnapshotsAPIBuilder)(nil)
	_ builder.APIGroupRouteProvider = (*SnapshotsAPIBuilder)(nil)
)

var resourceInfo = dashboardsnapshot.DashboardSnapshotResourceInfo

// This is used just so wire has something unique to return
type SnapshotsAPIBuilder struct {
	service    dashboardsnapshots.Service
	namespacer request.NamespaceMapper
	options    sharingOptionsGetter
	exporter   *dashExporter
	logger     log.Logger
}

func NewSnapshotsAPIBuilder(
	p dashboardsnapshots.Service,
	cfg setting.SettingsProvider,
	exporter *dashExporter,
) *SnapshotsAPIBuilder {
	return &SnapshotsAPIBuilder{
		service:    p,
		options:    newSharingOptionsGetter(cfg),
		namespacer: request.GetNamespaceMapper(cfg),
		exporter:   exporter,
		logger:     log.New("snapshots::RawHandlers"),
	}
}

func RegisterAPIService(
	service dashboardsnapshots.Service,
	apiregistration builder.APIRegistrar,
	settingsProvider setting.SettingsProvider,
	features featuremgmt.FeatureToggles,
	sql db.DB,
	reg prometheus.Registerer,
) *SnapshotsAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}
	builder := NewSnapshotsAPIBuilder(service, settingsProvider, &dashExporter{
		service: service,
		sql:     sql,
	})
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *SnapshotsAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return resourceInfo.GroupVersion()
}

func addKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) {
	scheme.AddKnownTypes(gv,
		&dashboardsnapshot.DashboardSnapshot{},
		&dashboardsnapshot.DashboardSnapshotList{},
		&dashboardsnapshot.SharingOptions{},
		&dashboardsnapshot.SharingOptionsList{},
		&dashboardsnapshot.FullDashboardSnapshot{},
		&dashboardsnapshot.DashboardSnapshotWithDeleteKey{},
		&metav1.Status{},
	)
}

func (b *SnapshotsAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := resourceInfo.GroupVersion()
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

func (b *SnapshotsAPIBuilder) AllowedV0Alpha1Resources() []string {
	return nil
}

func (b *SnapshotsAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, _ builder.APIGroupOptions) error {
	storage := map[string]rest.Storage{}

	legacyStore := &legacyStorage{
		service:    b.service,
		namespacer: b.namespacer,
		options:    b.options,
	}
	legacyStore.tableConverter = resourceInfo.TableConverter()
	storage[resourceInfo.StoragePath()] = legacyStore
	storage[resourceInfo.StoragePath("body")] = &subBodyREST{
		service:    b.service,
		namespacer: b.namespacer,
	}

	storage["options"] = &optionsStorage{
		getter:         b.options,
		tableConverter: legacyStore.tableConverter,
	}

	apiGroupInfo.VersionedResourcesStorageMap[dashboardsnapshot.VERSION] = storage
	return nil
}

func (b *SnapshotsAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return dashboardsnapshot.GetOpenAPIDefinitions
}

// Register additional routes with the server
func (b *SnapshotsAPIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	prefix := dashboardsnapshot.DashboardSnapshotResourceInfo.GroupResource().Resource
	defs := dashboardsnapshot.GetOpenAPIDefinitions(func(path string) spec.Ref { return spec.Ref{} })
	createCmd := defs["github.com/grafana/grafana/apps/dashboard/pkg/apissnapshot/v0alpha1.DashboardCreateCommand"].Schema
	createExample := `{"dashboard":{"annotations":{"list":[{"name":"Annotations & Alerts","enable":true,"iconColor":"rgba(0, 211, 255, 1)","snapshotData":[],"type":"dashboard","builtIn":1,"hide":true}]},"editable":true,"fiscalYearStartMonth":0,"graphTooltip":0,"id":203,"links":[],"liveNow":false,"panels":[{"datasource":null,"fieldConfig":{"defaults":{"color":{"mode":"palette-classic"},"custom":{"axisBorderShow":false,"axisCenteredZero":false,"axisColorMode":"text","axisLabel":"","axisPlacement":"auto","barAlignment":0,"drawStyle":"line","fillOpacity":43,"gradientMode":"opacity","hideFrom":{"legend":false,"tooltip":false,"viz":false},"insertNulls":false,"lineInterpolation":"smooth","lineWidth":1,"pointSize":5,"scaleDistribution":{"type":"linear"},"showPoints":"auto","spanNulls":false,"stacking":{"group":"A","mode":"none"},"thresholdsStyle":{"mode":"off"}},"mappings":[],"thresholds":{"mode":"absolute","steps":[{"color":"green","value":null},{"color":"red","value":80}]},"unitScale":true},"overrides":[]},"gridPos":{"h":8,"w":12,"x":0,"y":0},"id":1,"options":{"legend":{"calcs":[],"displayMode":"list","placement":"bottom","showLegend":true},"tooltip":{"mode":"single","sort":"none"}},"pluginVersion":"10.4.0-pre","snapshotData":[{"fields":[{"config":{"color":{"mode":"palette-classic"},"custom":{"axisBorderShow":false,"axisCenteredZero":false,"axisColorMode":"text","axisPlacement":"auto","barAlignment":0,"drawStyle":"line","fillOpacity":43,"gradientMode":"opacity","hideFrom":{"legend":false,"tooltip":false,"viz":false},"lineInterpolation":"smooth","lineWidth":1,"pointSize":5,"showPoints":"auto","thresholdsStyle":{"mode":"off"}},"thresholds":{"mode":"absolute","steps":[{"color":"green","value":null},{"color":"red","value":80}]},"unitScale":true},"name":"time","type":"time","values":[1706030536378,1706034856378,1706039176378,1706043496378,1706047816378,1706052136378]},{"config":{"color":{"mode":"palette-classic"},"custom":{"axisBorderShow":false,"axisCenteredZero":false,"axisColorMode":"text","axisLabel":"","axisPlacement":"auto","barAlignment":0,"drawStyle":"line","fillOpacity":43,"gradientMode":"opacity","hideFrom":{"legend":false,"tooltip":false,"viz":false},"insertNulls":false,"lineInterpolation":"smooth","lineWidth":1,"pointSize":5,"scaleDistribution":{"type":"linear"},"showPoints":"auto","spanNulls":false,"stacking":{"group":"A","mode":"none"},"thresholdsStyle":{"mode":"off"}},"mappings":[],"thresholds":{"mode":"absolute","steps":[{"color":"green","value":null},{"color":"red","value":80}]},"unitScale":true},"name":"A-series","type":"number","values":[1,20,90,30,50,0]}],"refId":"A"}],"targets":[],"title":"Simple example","type":"timeseries","links":[]}],"refresh":"","schemaVersion":39,"snapshot":{"timestamp":"2024-01-23T23:22:16.377Z"},"tags":[],"templating":{"list":[]},"time":{"from":"2024-01-23T17:22:20.380Z","to":"2024-01-23T23:22:20.380Z","raw":{"from":"now-6h","to":"now"}},"timepicker":{},"timezone":"","title":"simple and small","uid":"b22ec8db-399b-403b-b6c7-b0fb30ccb2a5","version":1,"weekStart":""},"name":"simple and small","expires":86400}`
	createRsp := defs["github.com/grafana/grafana/apps/dashboard/pkg/apissnapshot/v0alpha1.DashboardCreateResponse"].Schema

	tags := []string{dashboardsnapshot.DashboardSnapshotResourceInfo.GroupVersionKind().Kind}
	routes := &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: prefix + "/create",
				Spec: &spec3.PathProps{
					Post: &spec3.Operation{
						VendorExtensible: spec.VendorExtensible{
							Extensions: map[string]any{
								"x-grafana-action": "create",
								"x-kubernetes-group-version-kind": metav1.GroupVersionKind{
									Group:   dashboardsnapshot.GROUP,
									Version: dashboardsnapshot.VERSION,
									Kind:    "DashboardCreateResponse",
								},
							},
						},
						OperationProps: spec3.OperationProps{
							Tags:        tags,
							Summary:     "Full dashboard",
							Description: "longer description here?",
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
							RequestBody: &spec3.RequestBody{
								RequestBodyProps: spec3.RequestBodyProps{
									Content: map[string]*spec3.MediaType{
										"application/json": {
											MediaTypeProps: spec3.MediaTypeProps{
												Schema:  &createCmd,
												Example: createExample, // raw JSON body
											},
										},
									},
								},
							},
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										200: {
											ResponseProps: spec3.ResponseProps{
												Content: map[string]*spec3.MediaType{
													"application/json": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema: &createRsp,
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
				Handler: func(w http.ResponseWriter, r *http.Request) {
					user, err := identity.GetRequester(r.Context())
					if err != nil {
						errhttp.Write(r.Context(), err, w)
						return
					}
					wrap := &contextmodel.ReqContext{
						Logger: b.logger,
						Context: &web.Context{
							Req:  r,
							Resp: web.NewResponseWriter(r.Method, w),
						},
						// SignedInUser: user, ????????????
					}

					vars := mux.Vars(r)
					info, err := claims.ParseNamespace(vars["namespace"])
					if err != nil {
						wrap.JsonApiErr(http.StatusBadRequest, "expected namespace", nil)
						return
					}
					if info.OrgID != user.GetOrgID() {
						wrap.JsonApiErr(http.StatusBadRequest,
							fmt.Sprintf("user orgId does not match namespace (%d != %d)", info.OrgID, user.GetOrgID()), nil)
						return
					}

					cmd := dashboardsnapshots.CreateDashboardSnapshotCommand{}
					if err := web.Bind(wrap.Req, &cmd); err != nil {
						wrap.JsonApiErr(http.StatusBadRequest, "bad request data", err)
						return
					}

					opts, err := b.options(info.Value)
					if err != nil {
						wrap.JsonApiErr(http.StatusBadRequest, "error getting options", err)
						return
					}

					// Use the existing snapshot service
					dashboardsnapshots.CreateDashboardSnapshot(wrap, opts.Spec, cmd, b.service)
				},
			},
			{
				Path: prefix + "/delete/{deleteKey}",
				Spec: &spec3.PathProps{
					Summary:     "an example at the root level",
					Description: "longer description here?",
					Delete: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Tags: tags,
							Parameters: []*spec3.Parameter{
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "deleteKey",
										In:          "path",
										Required:    true,
										Description: "unique key returned in create",
										Schema:      spec.StringProperty(),
									},
								},
							},
						},
					},
				},
				Handler: func(w http.ResponseWriter, r *http.Request) {
					ctx := r.Context()
					vars := mux.Vars(r)
					key := vars["deleteKey"]

					err := dashboardsnapshots.DeleteWithKey(ctx, key, b.service)
					if err != nil {
						errhttp.Write(ctx, fmt.Errorf("failed to delete external dashboard (%w)", err), w)
						return
					}
					_ = json.NewEncoder(w).Encode(&util.DynMap{
						"message": "Snapshot deleted. It might take an hour before it's cleared from any CDN caches.",
					})
				},
			},
		},
	}

	// dev environment to export all snapshots to a blob store
	if b.exporter != nil && false {
		routes.Root = append(routes.Root, b.exporter.getAPIRouteHandler())
	}
	return routes
}

func (b *SnapshotsAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	// TODO: this behavior must match the existing logic (it is currently more restrictive)
	//
	// https://github.com/grafana/grafana/blob/f63e43c113ac0cf8f78ed96ee2953874139bd2dc/pkg/middleware/auth.go#L203
	// func SnapshotPublicModeOrSignedIn(cfg *setting.Cfg) web.Handler {
	// 	return func(c *contextmodel.ReqContext) {
	// 		if cfg.SnapshotPublicMode {
	// 			return
	// 		}

	// 		if !c.IsSignedIn {
	// 			notAuthorized(c)
	// 			return
	// 		}
	// 	}
	// }

	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorized authorizer.Decision, reason string, err error) {
			// Everyone can view dashsnaps
			if attr.GetVerb() == "get" && attr.GetResource() == dashboardsnapshot.DashboardSnapshotResourceInfo.GroupResource().Resource {
				return authorizer.DecisionAllow, "", err
			}

			// Fallback to the default behaviors (namespace matches org)
			return authorizer.DecisionNoOpinion, "", err
		})
}

func (b *SnapshotsAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "A dashboard snapshot shares an interactive dashboard publicly."

	// Set a description on the
	sub := oas.Paths.Paths["/apis/dashboardsnapshot.grafana.app/v0alpha1/namespaces/{namespace}/dashboardsnapshots/{name}/body"]
	if sub != nil && sub.Get != nil {
		sub.Get.Summary = "Full dashboard"
		sub.Get.Description = "Read the full dashboard body"
	}

	return oas, nil
}
