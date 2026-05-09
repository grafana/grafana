package snapshot

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/mux"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	authlib "github.com/grafana/authlib/types"
	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	commonv0 "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/metrics"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errhttp"
	"github.com/grafana/grafana/pkg/web"
)

var externalHTTPClient = &http.Client{Timeout: 5 * time.Second}

// createExternalSnapshot sends a snapshot creation request to the external snapshot server's K8s API.
func createExternalSnapshot(cmd *dashboardsnapshots.CreateDashboardSnapshotCommand, options dashv0.SnapshotSharingOptions) (*dashv0.DashboardCreateResponse, error) {
	externalURL := strings.TrimRight(options.ExternalSnapshotURL, "/") +
		"/apis/" + dashv0.GROUP + "/" + dashv0.VERSION + "/namespaces/default/snapshots/create"

	name := cmd.Name
	if name == "" {
		name = "Unnamed snapshot"
	}

	body, err := json.Marshal(map[string]any{
		"name":      name,
		"expires":   cmd.Expires,
		"dashboard": cmd.Dashboard,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal snapshot request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, externalURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if options.ExternalSnapshotToken != "" {
		req.Header.Set("Authorization", "Bearer "+options.ExternalSnapshotToken)
	}

	resp, err := externalHTTPClient.Do(req)
	if err != nil {
		return nil, dashboardsnapshots.ErrExternalSnapshotFailed.Errorf("failed to contact external snapshot server: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, dashboardsnapshots.ErrExternalSnapshotAuthFailed.Errorf("external snapshot server returned %d", resp.StatusCode)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, dashboardsnapshots.ErrExternalSnapshotFailed.Errorf("external snapshot server returned status code %d", resp.StatusCode)
	}

	var result dashv0.DashboardCreateResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode external snapshot response: %w", err)
	}

	return &result, nil
}

// nolint:gocyclo
func GetRoutes(service dashboardsnapshots.Service, options dashv0.SnapshotSharingOptions, accessControl ac.AccessControl, defs map[string]common.OpenAPIDefinition, storageGetter func() rest.Storage, dashboardService dashboards.DashboardService) *builder.APIRoutes {
	prefix := dashv0.SnapshotResourceInfo.GroupResource().Resource
	tags := []string{dashv0.SnapshotResourceInfo.GroupVersionKind().Kind}

	createCmd := defs["github.com/grafana/grafana/apps/dashboard/pkg/apissnapshot/v0alpha1.DashboardCreateCommand"].Schema
	createExample := `{"dashboard":{"annotations":{"list":[{"name":"Annotations & Alerts","enable":true,"iconColor":"rgba(0, 211, 255, 1)","snapshotData":[],"type":"dashboard","builtIn":1,"hide":true}]},"editable":true,"fiscalYearStartMonth":0,"graphTooltip":0,"id":203,"links":[],"liveNow":false,"panels":[{"datasource":null,"fieldConfig":{"defaults":{"color":{"mode":"palette-classic"},"custom":{"axisBorderShow":false,"axisCenteredZero":false,"axisColorMode":"text","axisLabel":"","axisPlacement":"auto","barAlignment":0,"drawStyle":"line","fillOpacity":43,"gradientMode":"opacity","hideFrom":{"legend":false,"tooltip":false,"viz":false},"insertNulls":false,"lineInterpolation":"smooth","lineWidth":1,"pointSize":5,"scaleDistribution":{"type":"linear"},"showPoints":"auto","spanNulls":false,"stacking":{"group":"A","mode":"none"},"thresholdsStyle":{"mode":"off"}},"mappings":[],"thresholds":{"mode":"absolute","steps":[{"color":"green","value":null},{"color":"red","value":80}]},"unitScale":true},"overrides":[]},"gridPos":{"h":8,"w":12,"x":0,"y":0},"id":1,"options":{"legend":{"calcs":[],"displayMode":"list","placement":"bottom","showLegend":true},"tooltip":{"mode":"single","sort":"none"}},"pluginVersion":"10.4.0-pre","snapshotData":[{"fields":[{"config":{"color":{"mode":"palette-classic"},"custom":{"axisBorderShow":false,"axisCenteredZero":false,"axisColorMode":"text","axisPlacement":"auto","barAlignment":0,"drawStyle":"line","fillOpacity":43,"gradientMode":"opacity","hideFrom":{"legend":false,"tooltip":false,"viz":false},"lineInterpolation":"smooth","lineWidth":1,"pointSize":5,"showPoints":"auto","thresholdsStyle":{"mode":"off"}},"thresholds":{"mode":"absolute","steps":[{"color":"green","value":null},{"color":"red","value":80}]},"unitScale":true},"name":"time","type":"time","values":[1706030536378,1706034856378,1706039176378,1706043496378,1706047816378,1706052136378]},{"config":{"color":{"mode":"palette-classic"},"custom":{"axisBorderShow":false,"axisCenteredZero":false,"axisColorMode":"text","axisLabel":"","axisPlacement":"auto","barAlignment":0,"drawStyle":"line","fillOpacity":43,"gradientMode":"opacity","hideFrom":{"legend":false,"tooltip":false,"viz":false},"insertNulls":false,"lineInterpolation":"smooth","lineWidth":1,"pointSize":5,"scaleDistribution":{"type":"linear"},"showPoints":"auto","spanNulls":false,"stacking":{"group":"A","mode":"none"},"thresholdsStyle":{"mode":"off"}},"mappings":[],"thresholds":{"mode":"absolute","steps":[{"color":"green","value":null},{"color":"red","value":80}]},"unitScale":true},"name":"A-series","type":"number","values":[1,20,90,30,50,0]}],"refId":"A"}],"targets":[],"title":"Simple example","type":"timeseries","links":[]}],"refresh":"","schemaVersion":39,"snapshot":{"timestamp":"2024-01-23T23:22:16.377Z"},"tags":[],"templating":{"list":[]},"time":{"from":"2024-01-23T17:22:20.380Z","to":"2024-01-23T23:22:20.380Z","raw":{"from":"now-6h","to":"now"}},"timepicker":{},"timezone":"","title":"simple and small","uid":"b22ec8db-399b-403b-b6c7-b0fb30ccb2a5","version":1,"weekStart":""},"name":"simple and small","expires":86400}`
	createRsp := defs["github.com/grafana/grafana/apps/dashboard/pkg/apissnapshot/v0alpha1.DashboardCreateResponse"].Schema
	getSettingsRsp := defs["github.com/grafana/grafana/apps/dashboard/pkg/apissnapshot/v0alpha1.SnapshotSharingOptions"].Schema
	getSettingsRspExample := `{"snapshotsEnabled":true,"externalSnapshotURL":"https://externalurl.com","externalSnapshotName":"external","externalEnabled":true}`

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
									Group:   dashv0.GROUP,
									Version: dashv0.VERSION,
									Kind:    "DashboardCreateResponse",
								},
							},
						},
						OperationProps: spec3.OperationProps{
							Tags:        tags,
							OperationId: "createSnapshot",
							Description: "Creates a new Snapshot",
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
					ctx := r.Context()
					user, err := identity.GetRequester(ctx)
					if err != nil {
						errhttp.Write(ctx, err, w)
						return
					}
					wrap := &contextmodel.ReqContext{
						Context: &web.Context{
							Req:  r,
							Resp: web.NewResponseWriter(r.Method, w),
						},
					}

					// RBAC check for snapshot creation
					if ok, err := accessControl.Evaluate(ctx, user, ac.EvalPermission(dashboards.ActionSnapshotsCreate)); !ok || err != nil {
						wrap.JsonApiErr(http.StatusForbidden, "access denied", err)
						return
					}

					if !options.SnapshotsEnabled {
						wrap.JsonApiErr(http.StatusForbidden, "Dashboard Snapshots are disabled", nil)
						return
					}

					vars := mux.Vars(r)
					namespace := vars["namespace"]
					info, err := authlib.ParseNamespace(namespace)
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

					if cmd.External && !options.ExternalEnabled {
						wrap.JsonApiErr(http.StatusForbidden, "External dashboard creation is disabled", nil)
						return
					}

					if cmd.Dashboard == nil {
						wrap.JsonApiErr(http.StatusBadRequest, "dashboard data is required", nil)
						return
					}

					// Validate that the dashboard exists
					dashboardUID, _ := cmd.Dashboard.Object["uid"].(string)
					if dashboardUID == "" {
						wrap.JsonApiErr(http.StatusBadRequest, "dashboard UID is required", nil)
						return
					}
					_, err = dashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{
						UID:   dashboardUID,
						OrgID: user.GetOrgID(),
					})
					if err != nil {
						wrap.JsonApiErr(http.StatusBadRequest, fmt.Sprintf("dashboard with UID %q not found", dashboardUID), nil)
						return
					}

					cmd.OrgID = user.GetOrgID()
					cmd.UserID, _ = identity.UserIdentifier(user.GetID())

					var snapshotURL string

					if cmd.External {
						resp, err := createExternalSnapshot(&cmd, options)
						if err != nil {
							errhttp.Write(ctx, err, w)
							return
						}

						cmd.Key = resp.Key
						cmd.DeleteKey = resp.DeleteKey
						cmd.ExternalURL = resp.URL
						cmd.ExternalDeleteURL = resp.DeleteURL
						cmd.Dashboard = &commonv0.Unstructured{}
						snapshotURL = resp.URL

						metrics.MApiDashboardSnapshotExternal.Inc()
					} else {
						originalDashboardURL, err := dashboardsnapshots.CreateOriginalDashboardURL(&cmd)
						if err != nil {
							errhttp.Write(ctx, fmt.Errorf("invalid app url: %w", err), w)
							return
						}

						snapshotURL, err = dashboardsnapshots.PrepareLocalSnapshot(&cmd, originalDashboardURL)
						if err != nil {
							errhttp.Write(ctx, fmt.Errorf("could not generate random string: %w", err), w)
							return
						}

						metrics.MApiDashboardSnapshotCreate.Inc()
					}

					storage := storageGetter()
					if storage == nil {
						errhttp.Write(ctx, fmt.Errorf("snapshot storage not available"), w)
						return
					}

					creater, ok := storage.(rest.Creater)
					if !ok {
						errhttp.Write(ctx, fmt.Errorf("snapshot storage does not support create"), w)
						return
					}

					// Convert command to K8s Snapshot
					snapshot := convertCreateCmdToK8sSnapshot(&cmd, namespace)

					snapshot.SetGenerateName("snapshot-")

					// Set namespace in context for k8s storage layer
					ctx = k8srequest.WithNamespace(ctx, namespace)

					// Create via storage (dual-write mode decides legacy, unified, or both)
					// TODO: split creation from Snapshot and the blob
					_, err = creater.Create(ctx, snapshot, nil, &metav1.CreateOptions{})
					if err != nil {
						errhttp.Write(ctx, err, w)
						return
					}

					// Build response
					response := dashv0.DashboardCreateResponse{
						Key:       snapshot.Name,
						DeleteKey: cmd.DeleteKey,
						URL:       snapshotURL,
						DeleteURL: setting.ToAbsUrl("apis/" + dashv0.GROUP + "/" + dashv0.VERSION + "/namespaces/" + namespace + "/" + prefix + "/delete/" + cmd.DeleteKey),
					}

					wrap.JSON(http.StatusOK, response)
				},
			},
			{
				Path: prefix + "/delete/{deleteKey}",
				Spec: &spec3.PathProps{
					Description: "Delete snapshot by delete key",
					Delete: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Tags:        tags,
							OperationId: "deleteWithKey",
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

					// RBAC check for snapshot deletion
					// The service account token is validated by Grafana's auth middleware
					user, err := identity.GetRequester(ctx)
					if err != nil {
						errhttp.Write(ctx, err, w)
						return
					}
					if ok, err := accessControl.Evaluate(ctx, user, ac.EvalPermission(dashboards.ActionSnapshotsDelete)); !ok || err != nil {
						w.WriteHeader(http.StatusForbidden)
						_ = json.NewEncoder(w).Encode(&util.DynMap{"message": "access denied"})
						return
					}

					vars := mux.Vars(r)
					deleteKey := vars["deleteKey"]
					namespace := vars["namespace"]

					storage := storageGetter()
					if storage == nil {
						errhttp.Write(ctx, fmt.Errorf("snapshot storage not available"), w)
						return
					}

					// Set namespace in context for k8s storage layer
					ctx = k8srequest.WithNamespace(ctx, namespace)

					// Look up snapshot by deleteKey using field selector
					lister, ok := storage.(rest.Lister)
					if !ok {
						errhttp.Write(ctx, fmt.Errorf("snapshot storage does not support list"), w)
						return
					}
					obj, err := lister.List(ctx, &internalversion.ListOptions{
						FieldSelector: fields.OneTermEqualSelector("spec.deleteKey", deleteKey),
					})
					if err != nil {
						errhttp.Write(ctx, fmt.Errorf("failed to look up snapshot: %w", err), w)
						return
					}
					snapList, ok := obj.(*dashv0.SnapshotList)
					if !ok || len(snapList.Items) == 0 {
						errhttp.Write(ctx, apierrors.NewNotFound(dashv0.SnapshotResourceInfo.GroupResource(), ""), w)
						return
					}
					if len(snapList.Items) > 1 {
						klog.Warningf("multiple snapshots found for delete key in namespace %q (count=%d); deleting only the first", namespace, len(snapList.Items))
					}
					snapshotName := snapList.Items[0].Name

					deleter, ok := storage.(rest.GracefulDeleter)
					if !ok {
						errhttp.Write(ctx, fmt.Errorf("snapshot storage does not support delete"), w)
						return
					}

					_, _, err = deleter.Delete(ctx, snapshotName, nil, &metav1.DeleteOptions{})
					if err != nil {
						errhttp.Write(ctx, fmt.Errorf("failed to delete snapshot: %w", err), w)
						return
					}
					_ = json.NewEncoder(w).Encode(&util.DynMap{
						"message": "Snapshot deleted. It might take an hour before it's cleared from any CDN caches.",
					})
				},
			},
			{
				Path: prefix + "/settings",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						VendorExtensible: spec.VendorExtensible{
							Extensions: map[string]any{
								"x-grafana-action": "get",
								"x-kubernetes-group-version-kind": metav1.GroupVersionKind{
									Group:   dashv0.GROUP,
									Version: dashv0.VERSION,
									Kind:    "SnapshotSharingOptions",
								},
							},
						},
						OperationProps: spec3.OperationProps{
							Tags:        tags,
							OperationId: "getSnapshotSettings",
							Description: "Get Snapshot sharing settings",
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
												Content: map[string]*spec3.MediaType{
													"application/json": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema:  &getSettingsRsp,
															Example: getSettingsRspExample,
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
					ctx := r.Context()
					user, err := identity.GetRequester(ctx)
					if err != nil {
						errhttp.Write(ctx, err, w)
						return
					}
					wrap := &contextmodel.ReqContext{
						Context: &web.Context{
							Req:  r,
							Resp: web.NewResponseWriter(r.Method, w),
						},
					}

					// RBAC check for reading snapshot settings
					if ok, err := accessControl.Evaluate(ctx, user, ac.EvalPermission(dashboards.ActionSnapshotsRead)); !ok || err != nil {
						wrap.JsonApiErr(http.StatusForbidden, "access denied", err)
						return
					}

					vars := mux.Vars(r)
					info, err := authlib.ParseNamespace(vars["namespace"])
					if err != nil {
						wrap.JsonApiErr(http.StatusBadRequest, "expected namespace", nil)
						return
					}
					if info.OrgID != user.GetOrgID() {
						wrap.JsonApiErr(http.StatusBadRequest,
							fmt.Sprintf("user orgId does not match namespace (%d != %d)", info.OrgID, user.GetOrgID()), nil)
						return
					}

					wrap.JSON(http.StatusOK, options)
				},
			},
		}}

	return routes
}
