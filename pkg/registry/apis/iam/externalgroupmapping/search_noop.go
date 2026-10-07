package externalgroupmapping

import (
	"fmt"
	"net/http"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/util/errhttp"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

var _ SearchHandler = (*NoopSearchREST)(nil)

type NoopSearchREST struct{}

func ProvideNoopSearchREST() *NoopSearchREST {
	return &NoopSearchREST{}
}

func (n *NoopSearchREST) GetAPIRoutes(defs map[string]common.OpenAPIDefinition) *builder.APIRoutes {
	searchResults := defs["github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.CreateSearchExternalGroupMappingsBody"].Schema
	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "searchExternalGroupMappings",
				Spec: &spec3.PathProps{
					Post: &spec3.Operation{
						Description: "Returns the team UIDs that map to any of the provided external group IDs.",
						Tags:        []string{"Search"},
						OperationId: "searchExternalGroupMappings",
						RequestBody: &spec3.RequestBody{
							Content: map[string]*spec3.MediaType{
								"application/json": {
									MediaTypeProps: spec3.MediaTypeProps{
										Schema: &spec.Schema{
											Type: []string{"object"},
											Properties: map[string]spec.Schema{
												"externalGroups": {
													SchemaProps: spec.SchemaProps{
														Type: []string{"array"},
														Items: &spec.SchemaOrArray{
															Schema: &spec.Schema{
																Type: []string{"string"},
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
						Parameters: []*spec3.Parameter{
							{
								Name:        "namespace",
								In:          "path",
								Required:    true,
								Example:     "default",
								Description: "workspace",
								Schema:      spec.StringProperty(),
							},
							{
								Name:        "limit",
								In:          "query",
								Description: "number of results to return",
								Example:     30,
								Required:    false,
								Schema:      spec.Int64Property(),
							},
							{
								Name:        "page",
								In:          "query",
								Description: "page number (starting from 1)",
								Example:     1,
								Required:    false,
								Schema:      spec.Int64Property(),
							},
							{
								Name:        "offset",
								In:          "query",
								Description: "number of results to skip",
								Example:     0,
								Required:    false,
								Schema:      spec.Int64Property(),
							},
						},
						Responses: &spec3.Responses{
							StatusCodeResponses: map[int]*spec3.Response{
								403: {
									ResponseProps: spec3.ResponseProps{
										Description: "Forbidden",
									},
								},
							},
							Default: &spec3.Response{
								Description: "Default OK response",
								Content: map[string]*spec3.MediaType{
									"application/json": {
										MediaTypeProps: spec3.MediaTypeProps{
											Schema: &searchResults,
										},
									},
								},
							},
						},
					},
				},
				Handler: n.doSearch,
			},
		},
	}
}

func (n *NoopSearchREST) doSearch(w http.ResponseWriter, r *http.Request) {
	errhttp.Write(r.Context(), errors.NewForbidden(iamv0.ExternalGroupMappingResourceInfo.GroupResource(), "", fmt.Errorf("functionality not available")), w)
}
