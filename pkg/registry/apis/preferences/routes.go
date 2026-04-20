package preferences

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path"
	"strconv"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"
	"sigs.k8s.io/yaml"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/resource"
	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

func (b *APIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	schema := defs[preferences.Preferences{}.OpenAPIModelName()].Schema

	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "preferences/merged",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							OperationId: "mergedPreferences",
							Tags:        []string{"Preferences"},
							Description: "Get preferences for requester.  This combines the user preferences with the team and global defaults",
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
									// Allow getting theme+language from accept
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
															Schema: &schema,
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
				Handler: b.merger.Current,
			}, {
				Path: "helpflags/{id}",
				Spec: &spec3.PathProps{
					Put: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							OperationId: "setHelpFlags",
							Tags:        []string{"Help Flags"},
							Description: "Set help flag",
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
										Name:        "id",
										In:          "path",
										Required:    true,
										Example:     "1",
										Description: "flag",
										Schema:      spec.Int64Property(),
									},
								},
							},
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										200: getHelpResponse(),
									},
								},
							},
						},
					},
				},
				Handler: func(w http.ResponseWriter, r *http.Request) {
					id := path.Base(r.URL.Path)
					val, err := strconv.ParseUint(id, 10, 64)
					if err != nil {
						errhttp.Write(r.Context(), err, w)
						return
					}

					data, err := b.doHelpFlags(r.Context(), &val)
					if err != nil {
						errhttp.Write(r.Context(), err, w)
						return
					}

					w.Header().Set("Content-Type", "application/json")
					err = json.NewEncoder(w).Encode(data)
					if err != nil {
						errhttp.Write(r.Context(), err, w)
					}
				},
			}, {
				Path: "helpflags",
				Spec: &spec3.PathProps{
					Delete: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							OperationId: "clearHelpFlags",
							Tags:        []string{"Help Flags"},
							Description: "Clear the help flags (useful for development)",
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
										200: getHelpResponse(),
									},
								},
							},
						},
					},
				},
				Handler: func(w http.ResponseWriter, r *http.Request) {
					data, err := b.doHelpFlags(r.Context(), nil) // nil will remove everything
					if err != nil {
						errhttp.Write(r.Context(), err, w)
						return
					}

					w.Header().Set("Content-Type", "application/json")
					err = json.NewEncoder(w).Encode(data)
					if err != nil {
						errhttp.Write(r.Context(), err, w)
					}
				},
			},
		},
	}
}

// Helper function that behaves just like the existing help flag
func (b *APIBuilder) doHelpFlags(ctx context.Context, set *uint64) (map[string]any, error) {
	id, ok := authlib.AuthInfoFrom(ctx)
	if !ok || id.GetIdentityType() != authlib.TypeUser {
		return nil, fmt.Errorf("only works for logged in users")
	}

	client, err := b.clientGenerator.ClientFor(preferences.PreferencesKind())
	if err != nil {
		return nil, err
	}

	p, err := client.Get(ctx, resource.Identifier{
		Namespace: request.NamespaceValue(ctx),
		Name:      fmt.Sprintf("user-%s", id.GetIdentifier()),
	})
	if err != nil {
		return nil, err
	}

	out, err := yaml.Marshal(p)
	if err != nil {
		return nil, err
	}
	fmt.Printf("GOT: %s\n\n", string(out))
	fmt.Printf("TODO, set: %v\n", set)

	return map[string]any{
		"message":    "Help flag set",
		"helpFlags1": 0,
	}, nil
}

func getHelpResponse() *spec3.Response {
	return &spec3.Response{
		ResponseProps: spec3.ResponseProps{
			Content: map[string]*spec3.MediaType{
				"application/json": {
					MediaTypeProps: spec3.MediaTypeProps{
						Schema: &spec.Schema{
							SchemaProps: spec.SchemaProps{
								Type: []string{"object"},
								Properties: map[string]spec.Schema{
									"message": {
										SchemaProps: spec.SchemaProps{
											Type: []string{"string"},
										},
									},
									"helpFlags1": {
										SchemaProps: spec.SchemaProps{
											Description: "Bitwise flags that will hide help modals in the UI\nNOTE: this property is only valid on user preferences",
											Type:        []string{"integer"},
											Format:      "uint64",
										},
									},
								},
								Required: []string{"metadata", "spec"},
							},
						},
					},
				},
			},
		}}
}
