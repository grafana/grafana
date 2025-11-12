package iam

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"

	"go.opentelemetry.io/otel/trace"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	teamsearch "github.com/grafana/grafana/pkg/services/team/search"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

type TeamSearchHandler struct {
	log      log.Logger
	client   resourcepb.ResourceIndexClient
	tracer   trace.Tracer
	features featuremgmt.FeatureToggles
}

func NewTeamSearchHandler(tracer trace.Tracer, dual dualwrite.Service, legacyTeamSearcher resourcepb.ResourceIndexClient, resourceClient resource.ResourceClient, features featuremgmt.FeatureToggles) *TeamSearchHandler {
	searchClient := resource.NewSearchClient(dualwrite.NewSearchAdapter(dual), iamv0alpha1.TeamResourceInfo.GroupResource(), resourceClient, legacyTeamSearcher, features)

	return &TeamSearchHandler{
		client:   searchClient,
		log:      log.New("grafana-apiserver.teams.search"),
		tracer:   tracer,
		features: features,
	}
}

func (s *TeamSearchHandler) GetAPIRoutes(defs map[string]common.OpenAPIDefinition) *builder.APIRoutes {
	searchResults := defs["github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.SearchResults"].Schema

	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "teams/search",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Tags:        []string{"Search"},
							Description: "Team search",
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
										Name:        "query",
										In:          "query",
										Description: "team name query string",
										Required:    false,
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
				},
				Handler: s.DoTeamSearch,
			},
		},
	}
}

func (s *TeamSearchHandler) DoTeamSearch(w http.ResponseWriter, r *http.Request) {
	ctx, span := s.tracer.Start(r.Context(), "team.search")
	defer span.End()

	queryParams, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	limit := 50
	offset := 0
	page := 1
	if queryParams.Has("limit") {
		limit, _ = strconv.Atoi(queryParams.Get("limit"))
	}
	if queryParams.Has("offset") {
		offset, _ = strconv.Atoi(queryParams.Get("offset"))
		if offset > 0 {
			page = (offset / limit) + 1
		}
	} else if queryParams.Has("page") {
		page, _ = strconv.Atoi(queryParams.Get("page"))
		offset = (page - 1) * limit
	}

	searchRequest := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{},
		Query:   queryParams.Get("query"),
		Limit:   int64(limit),
		Offset:  int64(offset),
		Page:    int64(page),
		Explain: queryParams.Has("explain") && queryParams.Get("explain") != "false",
	}

	result, err := s.client.Search(ctx, searchRequest)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	searchResults, err := teamsearch.ParseResults(result, searchRequest.Offset)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	s.write(w, searchResults)
}

func (s *TeamSearchHandler) write(w http.ResponseWriter, obj any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(obj)
}
