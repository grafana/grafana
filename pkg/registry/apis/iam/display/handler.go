package display

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	authlib "github.com/grafana/authlib/types"
	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

type Provider interface {
	GetDisplayList(ctx context.Context, ns authlib.NamespaceInfo, keys []string) (*iam.DisplayList, error)
}

type DisplayHandler struct {
	provider Provider
}

func NewDisplayHandler(provider Provider) *DisplayHandler {
	return &DisplayHandler{provider}
}

func (r *DisplayHandler) GetAPIRoutes(defs map[string]common.OpenAPIDefinition) *builder.APIRoutes {
	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "display",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							OperationId: "getDisplayMapping", // This is used by RTK client generator
							Tags:        []string{"Display"},
							Description: "Show user display information",
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
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "key",
										In:          "query",
										Description: "Display keys",
										Required:    true,
										Example:     "user:u000000001",
										Schema:      spec.ArrayProperty(spec.StringProperty()),
										//	Style:       "form",
										Explode: true,
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
															Schema: &spec.Schema{
																SchemaProps: spec.SchemaProps{
																	Ref: spec.MustCreateRef("#/components/schemas/" + iam.DisplayList{}.OpenAPIModelName()),
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
					},
				},
				Handler: r.handleDisplay,
			},
		},
	}
}

func (r *DisplayHandler) handleDisplay(w http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	user, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		errhttp.Write(ctx, apierrors.NewUnauthorized("missing auth info"), w)
		return
	}

	ns, err := authlib.ParseNamespace(user.GetNamespace())
	if err != nil {
		errhttp.Write(ctx, apierrors.NewBadRequest("missing namespace"), w)
		return
	}

	rsp, err := r.provider.GetDisplayList(ctx, ns, req.URL.Query()["key"])
	if err != nil {
		errhttp.Write(ctx, fmt.Errorf("error calling GetDisplayList %w", err), w) // 500
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(rsp)
}
