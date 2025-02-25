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
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// GetAPIRoutes implements the direct HTTP handlers that bypass k8s
func (b *APIBuilder) GetAPIRoutes() *builder.APIRoutes {
	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "stats",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							OperationId: "getResourceStats", // used for RTK client
							Tags:        []string{"Provisioning"},
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
															Schema: &spec.Schema{
																SchemaProps: spec.SchemaProps{
																	Ref: spec.MustCreateRef("#/components/schemas/com.github.grafana.grafana.pkg.apis.provisioning.v0alpha1.ResourceStats"),
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
				Handler: b.handleStats,
			},
			{
				Path: "settings",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							OperationId: "getFrontendSettings", // used for RTK client
							Tags:        []string{"Provisioning"},
							Description: "Get the frontend settings for this namespace",
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
															Schema: &spec.Schema{
																SchemaProps: spec.SchemaProps{
																	Ref: spec.MustCreateRef("#/components/schemas/com.github.grafana.grafana.pkg.apis.provisioning.v0alpha1.RepositoryViewList"),
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
				Handler: b.handleSettings,
			},
		},
	}
}

func (b *APIBuilder) handleStats(w http.ResponseWriter, r *http.Request) {
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

func (b *APIBuilder) handleSettings(w http.ResponseWriter, r *http.Request) {
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

	settings := provisioning.RepositoryViewList{
		Items:                     make([]provisioning.RepositoryView, len(all)),
		LegacyStorage:             dualwrite.IsReadingLegacyDashboardsAndFolders(ctx, b.storageStatus),
		GenerateDashboardPreviews: b.render != nil && b.render.IsAvailable(ctx),
		GithubWebhooks:            b.isPublic,
	}

	for i, val := range all {
		settings.Items[i] = provisioning.RepositoryView{
			Name:     val.ObjectMeta.Name,
			Title:    val.Spec.Title,
			Type:     val.Spec.Type,
			ReadOnly: len(val.Spec.Workflows) == 0,
			Target:   val.Spec.Sync.Target,
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(settings)
}
