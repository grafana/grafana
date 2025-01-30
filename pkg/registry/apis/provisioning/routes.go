package provisioning

import (
	"encoding/json"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	authlib "github.com/grafana/authlib/types"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	listers "github.com/grafana/grafana/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// GetAPIRoutes implements the direct HTTP handlers that bypass k8s
func (b *ProvisioningAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })

	statsResult := defs["github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1.ResourceStats"].Schema

	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "stats",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							OperationId: "getResourceStats", // used for RTK client
							Tags:        []string{"Repository"},
							Description: "Get resource stats for this namespace",
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
															Schema: &statsResult,
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
				Handler: b.handleStats,
			},
		},
	}
}

type routeHandler struct {
	resourceLister   resources.ResourceLister
	repositoryLister listers.RepositoryLister
}

func (b *routeHandler) handleStats(w http.ResponseWriter, r *http.Request) {
	u, ok := authlib.AuthInfoFrom(r.Context())
	if !ok {
		w.WriteHeader(400)
		_, _ = w.Write([]byte("expected user"))
		return
	}
	stats, err := b.resourceLister.Stats(r.Context(), u.GetNamespace(), "")
	if err != nil {
		errhttp.Write(r.Context(), err, w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(stats)
}

func (b *routeHandler) handleSettings(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	u, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		errhttp.Write(ctx, fmt.Errorf("expected user"), w)
		return
	}

	all, err := b.repositoryLister.Repositories(u.GetNamespace()).List(labels.Everything())
	if err != nil {
		errhttp.Write(r.Context(), err, w)
		return
	}

	settings := provisioning.FrontendSettings{
		Repository: make(map[string]provisioning.RepositoryView, len(all)+2),
	}
	for _, val := range all {
		settings.Repository[val.Name] = provisioning.RepositoryView{
			Title:       val.Spec.Title,
			Description: val.Spec.Description,
			Type:        val.Spec.Type,
			Folder:      val.Spec.Folder,
		}
		if val.Spec.Folder == "" {
			settings.Global = val.Name
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(settings)
}
