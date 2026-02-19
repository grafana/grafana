package customtheme

import (
	"encoding/json"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	customtheme "github.com/grafana/grafana/pkg/apis/customtheme/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

func getByUserRoutes(store rest.Storage) *builder.APIRoutes {
	listSchema := spec.Schema{
		SchemaProps: spec.SchemaProps{
			Type: []string{"object"},
			Ref:  spec.MustCreateRef("#/definitions/" + customtheme.CustomThemeList{}.OpenAPIModelName()),
		},
	}

	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "customthemes/byuser/{userUid}",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							OperationId: "getCustomThemesByUser",
							Tags:        []string{"CustomTheme"},
							Description: "Get custom themes for a specific user. Use includeGlobal=true to also include themes available globally (those with no user assigned).",
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
										Name:        "userUid",
										In:          "path",
										Required:    true,
										Description: "The UID of the user whose themes to retrieve",
										Schema:      spec.StringProperty(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "includeGlobal",
										In:          "query",
										Description: "When true, also include themes that are available globally (no user assigned)",
										Schema:      spec.BoolProperty(),
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
															Schema: &listSchema,
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
				Handler: byUserHandler(store),
			},
		},
	}
}

func byUserHandler(store rest.Storage) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		userUid := r.PathValue("userUid")
		if userUid == "" {
			http.Error(w, "userUid is required", http.StatusBadRequest)
			return
		}
		includeGlobal := r.URL.Query().Get("includeGlobal") == "true"

		lister, ok := store.(rest.Lister)
		if !ok {
			http.Error(w, "store does not support listing", http.StatusInternalServerError)
			return
		}

		listObj, err := lister.List(ctx, nil)
		if err != nil {
			errhttp.Write(ctx, err, w)
			return
		}

		allThemes, ok := listObj.(*customtheme.CustomThemeList)
		if !ok {
			http.Error(w, "unexpected list type", http.StatusInternalServerError)
			return
		}

		filtered := filterThemesByUser(allThemes.Items, userUid, includeGlobal)

		result := &customtheme.CustomThemeList{
			TypeMeta: metav1.TypeMeta{
				Kind:       "CustomThemeList",
				APIVersion: customtheme.APIVERSION,
			},
			ListMeta: allThemes.ListMeta,
			Items:    filtered,
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(result)
	}
}

func filterThemesByUser(themes []customtheme.CustomTheme, userUid string, includeGlobal bool) []customtheme.CustomTheme {
	var result []customtheme.CustomTheme
	for _, theme := range themes {
		if theme.Spec.UserUID == userUid {
			result = append(result, theme)
		} else if includeGlobal && theme.Spec.UserUID == "" {
			result = append(result, theme)
		}
	}
	return result
}
