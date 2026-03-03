package iam

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/util/errhttp"
	"github.com/grafana/grafana/pkg/web"
)

type AccessCheckHandler struct {
	client types.AccessClient
}

func NewAccessCheckHandler(client types.AccessClient) *AccessCheckHandler {
	return &AccessCheckHandler{client: client}
}

func (s *AccessCheckHandler) GetAPIRoutes(defs map[string]common.OpenAPIDefinition) *builder.APIRoutes {
	checkRequest := defs[iamv0alpha1.CreateAccessCheckRequestBody{}.OpenAPIModelName()].Schema
	checkResults := defs[iamv0alpha1.CreateAccessCheckResponse{}.OpenAPIModelName()].Schema

	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "access/check",
				Spec: &spec3.PathProps{
					Post: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Tags:        []string{"Access"},
							OperationId: "checkAccess",
							Description: "Check access",
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
												Schema: &checkRequest,
												Examples: map[string]*spec3.Example{
													"dashboard permissions": {
														ExampleProps: spec3.ExampleProps{
															Value: iamv0alpha1.CreateAccessCheckRequestBody{
																Check: map[string]iamv0alpha1.CreateAccessCheckRequestAccessCheckRequest{
																	"list": {
																		Verb:     "list",
																		Group:    "dashboard.grafana.app",
																		Resource: "dashboards",
																	},
																	"create": {
																		Verb:     "create",
																		Group:    "dashboard.grafana.app",
																		Resource: "dashboards",
																	},
																	"update": {
																		Verb:     "update",
																		Group:    "dashboard.grafana.app",
																		Resource: "dashboards",
																	},
																	"admin": {
																		Verb:     "admin",
																		Group:    "dashboard.grafana.app",
																		Resource: "dashboards",
																	},
																},
															},
														},
													},
													"unknown resource": {
														ExampleProps: spec3.ExampleProps{
															Value: iamv0alpha1.CreateAccessCheckRequestBody{
																Check: map[string]iamv0alpha1.CreateAccessCheckRequestAccessCheckRequest{
																	"list": {
																		Verb:     "list",
																		Group:    "dashboard.grafana.app",
																		Resource: "not-a-resource",
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
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										200: {
											ResponseProps: spec3.ResponseProps{
												Content: map[string]*spec3.MediaType{
													"application/json": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema: &checkResults,
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
				Handler: s.DoAccessCheck,
			},
		},
	}
}

func (s *AccessCheckHandler) DoAccessCheck(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	requester, ok := types.AuthInfoFrom(ctx)
	if !ok {
		errhttp.Write(ctx, fmt.Errorf("no identity found for request"), w)
		return
	}

	vars := mux.Vars(r)
	namespace := vars["namespace"]
	if namespace == "" {
		errhttp.Write(ctx, fmt.Errorf("missing namespace"), w)
		return
	}
	if namespace != requester.GetNamespace() {
		errhttp.Write(ctx, fmt.Errorf("expected the same namespace as the user request"), w)
		return
	}

	req := iamv0alpha1.NewCreateAccessCheckRequestBody()
	if err := web.Bind(r, req); err != nil {
		errhttp.Write(ctx, fmt.Errorf("unable to bind request: %w", err), w)
		return
	}

	rsp := iamv0alpha1.NewCreateAccessCheckResponse()
	if req.Debug {
		rsp.Debug = &iamv0alpha1.CreateAccessCheckV0alpha1ResponseDebug{
			Check: map[string]iamv0alpha1.CreateAccessCheckV0alpha1ResponseDebugCheck{},
			Auth: iamv0alpha1.CreateAccessCheckV0alpha1ResponseDebugAuth{
				Name: requester.GetName(),
				Type: string(requester.GetIdentityType()),
				Uid:  requester.GetUID(),
			},
		}
	}

	batch := types.BatchCheckRequest{
		Namespace: namespace,
		SkipCache: req.SkipCache,
		Checks:    make([]types.BatchCheckItem, 0, len(req.Check)),
	}
	for k, check := range req.Check {
		batch.Checks = append(batch.Checks, types.BatchCheckItem{
			CorrelationID: k, // the result in key
			Verb:          check.Verb,
			Group:         check.Group,
			Resource:      check.Resource,
			Name:          check.Name,
			Subresource:   check.Subresource,
			Path:          check.Path,
			Folder:        check.Folder,
		})
	}
	batchResponse, err := s.client.BatchCheck(ctx, requester, batch)
	if err != nil {
		errhttp.Write(ctx, fmt.Errorf("error checking access: %w", err), w)
		return
	}

	for k, v := range batchResponse.Results {
		rsp.Allowed[k] = v.Allowed
		if req.Debug {
			rsp.Debug.Check[k] = iamv0alpha1.CreateAccessCheckV0alpha1ResponseDebugCheck{
				Check:   iamv0alpha1.CreateAccessCheckAccessCheckRequest(req.Check[k]), // ensures we parsed it OK
				Allowed: v.Allowed,
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(rsp)
}
