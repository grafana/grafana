package dashboard

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"slices"
	"sort"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/storage/unified"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apis/dashboard"
	dashboardv0alpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	folderv0alpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	dashboardsearch "github.com/grafana/grafana/pkg/services/dashboards/service/search"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// The DTO returns everything the UI needs in a single request
type SearchHandler struct {
	log    log.Logger
	client func(context.Context) resource.ResourceIndexClient
	tracer trace.Tracer
}

func NewSearchHandler(tracer trace.Tracer, cfg *setting.Cfg, legacyDashboardSearcher resource.ResourceIndexClient) *SearchHandler {
	searchClient := resource.NewSearchClient(cfg, setting.UnifiedStorageConfigKeyDashboard, unified.GetResourceClient, legacyDashboardSearcher)
	return &SearchHandler{
		client: searchClient,
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

const rootFolder = "general"

// nolint:gocyclo
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
	page := 1
	if queryParams.Has("limit") {
		limit, _ = strconv.Atoi(queryParams.Get("limit"))
	}
	if queryParams.Has("offset") {
		offset, _ = strconv.Atoi(queryParams.Get("offset"))
	} else if queryParams.Has("page") {
		page, _ = strconv.Atoi(queryParams.Get("page"))
	}

	searchRequest := &resource.ResourceSearchRequest{
		Options: &resource.ListOptions{},
		Query:   queryParams.Get("query"),
		Limit:   int64(limit),
		Offset:  int64(offset),
		Page:    int64(page), // for modes 0-2 (legacy)
		Explain: queryParams.Has("explain") && queryParams.Get("explain") != "false",
	}
	fields := []string{"title", "folder", "tags"}
	if queryParams.Has("field") {
		// add fields to search and exclude duplicates
		for _, f := range queryParams["field"] {
			if f != "" && !slices.Contains(fields, f) {
				fields = append(fields, f)
			}
		}
	}
	searchRequest.Fields = fields

	// Add the folder constraint. Note this does not do recursive search
	folder := queryParams.Get("folder")
	if folder != "" {
		if folder == rootFolder {
			folder = "" // root folder is empty in the search index
		}
		searchRequest.Options.Fields = []*resource.Requirement{{
			Key:      "folder",
			Operator: "=",
			Values:   []string{folder},
		}}
	}

	types := queryParams["type"]
	var federate *resource.ResourceKey
	switch len(types) {
	case 0:
		// When no type specified, search for dashboards
		searchRequest.Options.Key, err = asResourceKey(user.GetNamespace(), dashboard.DASHBOARD_RESOURCE)
		// Currently a search query is across folders and dashboards
		if err == nil {
			federate, err = asResourceKey(user.GetNamespace(), folderv0alpha1.RESOURCE)
		}
	case 1:
		searchRequest.Options.Key, err = asResourceKey(user.GetNamespace(), types[0])
	case 2:
		searchRequest.Options.Key, err = asResourceKey(user.GetNamespace(), types[0])
		if err == nil {
			federate, err = asResourceKey(user.GetNamespace(), types[1])
		}
	default:
		err = apierrors.NewBadRequest("too many type requests")
	}
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}
	if federate != nil {
		searchRequest.Federated = []*resource.ResourceKey{federate}
	}

	// Add sorting
	if queryParams.Has("sort") {
		for _, sort := range queryParams["sort"] {
			if slices.Contains(search.DashboardFields(), sort) {
				sort = "fields." + sort
			}
			s := &resource.ResourceSearchRequest_Sort{Field: sort}
			if strings.HasPrefix(sort, "-") {
				s.Desc = true
				s.Field = s.Field[1:]
			}
			searchRequest.SortBy = append(searchRequest.SortBy, s)
		}
	}

	// The facet term fields
	if facets, ok := queryParams["facet"]; ok {
		searchRequest.Facet = make(map[string]*resource.ResourceSearchRequest_Facet)
		for _, v := range facets {
			searchRequest.Facet[v] = &resource.ResourceSearchRequest_Facet{
				Field: v,
				Limit: 50,
			}
		}
	}

	// The tags filter
	if tags, ok := queryParams["tag"]; ok {
		searchRequest.Options.Fields = []*resource.Requirement{{
			Key:      "tags",
			Operator: "=",
			Values:   tags,
		}}
	}

	// The names filter
	if names, ok := queryParams["name"]; ok {
		if searchRequest.Options.Fields == nil {
			searchRequest.Options.Fields = []*resource.Requirement{}
		}
		namesFilter := []*resource.Requirement{{
			Key:      "name",
			Operator: "in",
			Values:   names,
		}}
		searchRequest.Options.Fields = append(searchRequest.Options.Fields, namesFilter...)
	}

	result, err := s.client(ctx).Search(ctx, searchRequest)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	parsedResults, err := dashboardsearch.ParseResults(result, searchRequest.Offset)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	if len(searchRequest.SortBy) == 0 {
		// default sort by resource descending ( folders then dashboards ) then title
		sort.Slice(parsedResults.Hits, func(i, j int) bool {
			return parsedResults.Hits[i].Resource > parsedResults.Hits[j].Resource ||
				(parsedResults.Hits[i].Resource == parsedResults.Hits[j].Resource && strings.ToLower(parsedResults.Hits[i].Title) < strings.ToLower(parsedResults.Hits[j].Title))
		})
	}

	s.write(w, parsedResults)
}

func (s *SearchHandler) write(w http.ResponseWriter, obj any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(obj)
}

// Given a namespace and type convert it to a search key
func asResourceKey(ns string, k string) (*resource.ResourceKey, error) {
	key, err := resource.AsResourceKey(ns, k)
	if err != nil {
		return nil, apierrors.NewBadRequest(err.Error())
	}

	return key, nil
}
