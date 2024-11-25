package dashboard

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"go.opentelemetry.io/otel/trace"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	dashboardv0alpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// The DTO returns everything the UI needs in a single request
type SearchHandler struct {
	log    log.Logger
	client resource.ResourceIndexClient
	tracer trace.Tracer
}

func NewSearchHandler(client resource.ResourceIndexClient, tracer trace.Tracer) *SearchHandler {
	return &SearchHandler{
		client: client,
		log:    log.New("grafana-apiserver.dashboards.search"),
		tracer: tracer,
	}
}

func (s *SearchHandler) GetAPIRoutes(defs map[string]common.OpenAPIDefinition) *builder.APIRoutes {
	searchResults := defs["github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1.SearchResults"].Schema
	sortableFields := defs["github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1.SortableFields"].Schema

	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "search",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Tags:        []string{"Search"},
							Description: "Dashboard search",
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
										Description: "user query string",
										Required:    false,
										Schema:      spec.StringProperty(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "folder",
										In:          "query",
										Description: "search/list within a folder (not recursive)",
										Required:    false,
										Schema:      spec.StringProperty(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "sort",
										In:          "query",
										Description: "sortable field",
										Example:     "", // not sorted
										Examples: map[string]*spec3.Example{
											"": {
												ExampleProps: spec3.ExampleProps{
													Summary: "default sorting",
													Value:   "",
												},
											},
											"title": {
												ExampleProps: spec3.ExampleProps{
													Summary: "title ascending",
													Value:   "title",
												},
											},
											"-title": {
												ExampleProps: spec3.ExampleProps{
													Summary: "title descending",
													Value:   "-title",
												},
											},
										},
										Required: false,
										Schema:   spec.StringProperty(),
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
				Handler: s.DoSearch,
			},
			{
				Path: "search/sortable",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Tags:        []string{"Search"},
							Description: "Get sortable fields",
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
															Schema: &sortableFields,
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
				Handler: s.DoSortable,
			},
		},
	}
}

func (s *SearchHandler) DoSortable(w http.ResponseWriter, r *http.Request) {
	sortable := &dashboardv0alpha1.SortableFields{
		TypeMeta: v1.TypeMeta{
			APIVersion: dashboardv0alpha1.APIVERSION,
			Kind:       "SortableFields",
		},
		Fields: []dashboardv0alpha1.SortableField{
			{Field: "title", Display: "Title (A-Z)", Type: "string"},
			{Field: "-title", Display: "Title (Z-A)", Type: "string"},
		},
	}
	s.write(w, sortable)
}

func (s *SearchHandler) DoSearch(w http.ResponseWriter, r *http.Request) {
	ctx, span := s.tracer.Start(r.Context(), "dashboard.search")
	defer span.End()

	user, err := identity.GetRequester(ctx)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	queryParams, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	// get limit and offset from query params
	limit := 50
	offset := 0
	if queryParams.Has("limit") {
		limit, _ = strconv.Atoi(queryParams.Get("limit"))
	}
	if queryParams.Has("offset") {
		offset, _ = strconv.Atoi(queryParams.Get("offset"))
	}

	searchRequest := &resource.ResourceSearchRequest{
		Options: &resource.ListOptions{
			Key: &resource.ResourceKey{
				Namespace: user.GetNamespace(),
				Group:     dashboardv0alpha1.GROUP,
				Resource:  "dashboards",
			},
		},
		Query:  queryParams.Get("query"),
		Limit:  int64(limit),
		Offset: int64(offset),
		Fields: []string{
			"title",
			"folder",
			"tags",
		},
	}

	// Add the folder constraint. Note this does not do recursive search
	folder := queryParams.Get("folder")
	if folder != "" {
		searchRequest.Options.Fields = []*resource.Requirement{{
			Key:      "folder",
			Operator: "=",
			Values:   []string{folder},
		}}
	}

	// Add sorting
	if queryParams.Has("sort") {
		for _, sort := range queryParams["sort"] {
			s := &resource.ResourceSearchRequest_Sort{Field: sort}
			if strings.HasPrefix(sort, "-") {
				s.Desc = true
				s.Field = s.Field[1:]
			}
			searchRequest.SortBy = append(searchRequest.SortBy, s)
		}
	}

	// Also query folders
	if searchRequest.Query != "" {
		searchRequest.Federated = []*resource.ResourceKey{{
			Namespace: searchRequest.Options.Key.Namespace,
			Group:     "folder.grafana.app",
			Resource:  "folders",
		}}
	}

	// The facet term fields
	facets, ok := queryParams["facet"]
	if ok {
		searchRequest.Facet = make(map[string]*resource.ResourceSearchRequest_Facet)
		for _, v := range facets {
			searchRequest.Facet[v] = &resource.ResourceSearchRequest_Facet{
				Field: v,
				Limit: 50,
			}
		}
	}

	// Run the query
	result, err := s.client.Search(ctx, searchRequest)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	sr := &dashboardv0alpha1.SearchResults{
		Offset:    searchRequest.Offset,
		TotalHits: result.TotalHits,
		QueryCost: result.QueryCost,
		MaxScore:  result.MaxScore,
		Hits:      make([]dashboardv0alpha1.DashboardHit, len(result.Results.Rows)),
	}
	for i, row := range result.Results.Rows {
		hit := &dashboardv0alpha1.DashboardHit{
			Kind:   dashboardv0alpha1.HitTypeDash,
			Name:   row.Key.Name,
			Title:  string(row.Cells[0]),
			Folder: string(row.Cells[1]),
		}
		if row.Cells[2] != nil {
			_ = json.Unmarshal(row.Cells[2], &hit.Tags)
		}
		sr.Hits[i] = *hit
	}

	// Add facet results
	if result.Facet != nil {
		sr.Facets = make(map[string]dashboardv0alpha1.FacetResult)
		for k, v := range result.Facet {
			sr.Facets[k] = dashboardv0alpha1.FacetResult{
				Field:   v.Field,
				Total:   v.Total,
				Missing: v.Missing,
				Terms:   make([]dashboardv0alpha1.TermFacet, len(v.Terms)),
			}
			for j, t := range v.Terms {
				sr.Facets[k].Terms[j] = dashboardv0alpha1.TermFacet{
					Term:  t.Term,
					Count: t.Count,
				}
			}
		}
	}

	s.write(w, sr)
}

func (s *SearchHandler) write(w http.ResponseWriter, obj any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(obj)
}
