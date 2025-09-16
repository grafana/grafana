package provisioning

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	authlib "github.com/grafana/authlib/types"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// TODO: Move the specific logic to the connector so that we don't have logic all over the place.
// GetAPIRoutes implements the direct HTTP handlers that bypass k8s
func (b *APIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "stats",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							OperationId: "getResourceStats",                     // used for RTK client
							Tags:        []string{"Provisioning", "Repository"}, // includes stats for repositores and provisiong in general
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
																	Ref: spec.MustCreateRef("#/components/schemas/com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ResourceStats"),
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
				Handler: WithTimeoutFunc(b.handleStats, 30*time.Second),
			},
			{
				Path: "settings",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							OperationId: "getFrontendSettings", // used for RTK client
							// includes stats for repositores and provisiong in general
							// This must include "Repository" so that the RTK client will invalidate when things are deleted
							Tags:        []string{"Provisioning", "Repository"},
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
																	Ref: spec.MustCreateRef("#/components/schemas/com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.RepositoryViewList"),
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
				Handler: WithTimeoutFunc(b.handleSettings, 30*time.Second),
			},
		},
	}
}

// TODO: why didn't we create a connector as we did before or have a separate file?
func (b *APIBuilder) handleStats(w http.ResponseWriter, r *http.Request) {
	u, ok := authlib.AuthInfoFrom(r.Context())
	if !ok {
		w.WriteHeader(400)
		_, _ = w.Write([]byte("expected user"))
		return
	}
	// TODO: check if lister could list too many repositories or resources
	stats, err := b.resourceLister.Stats(r.Context(), u.GetNamespace(), "")
	if err != nil {
		errhttp.Write(r.Context(), err, w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(stats)
}

// TODO: why didn't we create a connector as we did before or have a separate file?
// TODO: is there a better way to provide a filtered view of the repositories to the frontend?
func (b *APIBuilder) handleSettings(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	u, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		errhttp.Write(ctx, fmt.Errorf("expected user"), w)
		return
	}

	// TODO: check if lister could list too many repositories or resources
	all, err := b.getRepositoriesInNamespace(request.WithNamespace(r.Context(), u.GetNamespace()))
	if err != nil {
		errhttp.Write(r.Context(), err, w)
		return
	}

	legacyStorage := false
	if b.storageStatus != nil {
		legacyStorage = dualwrite.IsReadingLegacyDashboardsAndFolders(ctx, b.storageStatus)
	}

	settings := provisioning.RepositoryViewList{
		Items: make([]provisioning.RepositoryView, len(all)),
		// FIXME: this shouldn't be here in provisioning but at the dual writer or something about the storage
		LegacyStorage:            legacyStorage,
		AvailableRepositoryTypes: b.repoFactory.Types(),
	}

	for i, val := range all {
		branch := ""
		if val.Spec.GitHub != nil {
			branch = val.Spec.GitHub.Branch
		}
		settings.Items[i] = provisioning.RepositoryView{
			Name:      val.Name,
			Title:     val.Spec.Title,
			Type:      val.Spec.Type,
			Target:    val.Spec.Sync.Target,
			Branch:    branch,
			Workflows: val.Spec.Workflows,
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(settings)
}
