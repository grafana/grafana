package user

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"

	"go.opentelemetry.io/otel/trace"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

type SearchHandler struct {
	log      *slog.Logger
	client   resourcepb.ResourceIndexClient
	tracer   trace.Tracer
	features featuremgmt.FeatureToggles
}

func NewSearchHandler(tracer trace.Tracer, searchClient resourcepb.ResourceIndexClient, features featuremgmt.FeatureToggles) *SearchHandler {
	// searchClient := resource.NewSearchClient(dualwrite.NewSearchAdapter(dual), iamv0.UserResourceInfo.GroupResource(),
	// 	unified, NewUserLegacySearchClient(legacyUserSvc), features)
	return &SearchHandler{
		client:   searchClient,
		log:      slog.Default().With("logger", "grafana-apiserver.user.search"),
		tracer:   tracer,
		features: features,
	}
}

func (s *SearchHandler) GetAPIRoutes(defs map[string]common.OpenAPIDefinition) *builder.APIRoutes {
	searchResults := defs["github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.GetSearchUser"].Schema
	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "searchUser",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Description: "User search",
							OperationId: "getSearchUser",
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
										Name:     "query",
										In:       "query",
										Required: true,
										Schema:   spec.StringProperty(),
									},
								},
							},
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									Default: &spec3.Response{
										ResponseProps: spec3.ResponseProps{
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
						},
					},
				},
				Handler: s.DoSearch,
			},
		},
	}
}

func (s *SearchHandler) DoSearch(w http.ResponseWriter, r *http.Request) {
	ctx, span := s.tracer.Start(r.Context(), "user.search")
	defer span.End()

	queryParams, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	ident, ok := types.AuthInfoFrom(ctx)
	if !ok {
		errhttp.Write(ctx, fmt.Errorf("no identity found for request"), w)
		return
	}

	userGvr := iamv0.UserResourceInfo.GroupResource()
	request := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:     userGvr.Group,
				Resource:  userGvr.Resource,
				Namespace: ident.GetNamespace(),
			},
		},
		Query:  queryParams.Get("query"),
		Fields: []string{"title", "fields.name", "fields.login"},
	}

	resp, err := s.client.Search(ctx, request)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	result := iamv0.NewGetSearchUser()
	result.TotalHits = resp.TotalHits
	result.QueryCost = resp.QueryCost
	result.MaxScore = resp.MaxScore
	result.Hits = make([]iamv0.UserHit, 0, resp.TotalHits)

	if resp.TotalHits > 0 {
		for _, row := range resp.Results.Rows {
			hit := iamv0.UserHit{
				Name: row.Key.Name,
			}
			result.Hits = append(result.Hits, hit)
		}
	}
	s.write(w, result)
}

func (s *SearchHandler) write(w http.ResponseWriter, obj any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(obj)
}
