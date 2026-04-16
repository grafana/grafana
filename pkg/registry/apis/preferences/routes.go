package preferences

import (
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"k8s.io/apiserver/pkg/endpoints/request"

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
					ctx := r.Context()
					id, ok := authlib.AuthInfoFrom(ctx)
					if !ok || id.GetIdentityType() != authlib.TypeUser {
						errhttp.Write(ctx, fmt.Errorf("only works for logged in users"), w)
						return
					}

					client, err := b.clientGetter(ctx)
					if err != nil {
						errhttp.Write(ctx, err, w)
						return
					}

					p, err := client.Get(ctx, resource.Identifier{
						Namespace: request.NamespaceValue(ctx),
						Name:      fmt.Sprintf("user-%s", id.GetIdentifier()),
					})

					fmt.Printf("GOT: %+v\n%v", p, err)

					// &util.DynMap{"message": "Help flag set", "helpFlags1": *bitmask}
					w.Write([]byte("TODO... set flags"))
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
					// &util.DynMap{"message": "Help flag set", "helpFlags1": *bitmask}
					w.Write([]byte("TODO... delete flags"))
				},
			},
		},
	}
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
