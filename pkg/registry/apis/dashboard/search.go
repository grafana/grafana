package dashboard

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	dashboardv0alpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	dashboardsvc "github.com/grafana/grafana/pkg/services/dashboards/service"
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
		Options: &resource.ListOptions{},
		Query:   queryParams.Get("query"),
		Limit:   int64(limit),
		Offset:  int64(offset),
		Explain: queryParams.Has("explain") && queryParams.Get("explain") != "false",
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

	types := queryParams["type"]
	var federate *resource.ResourceKey
	switch len(types) {
	case 0:
		// When no type specified, search for dashboards
		searchRequest.Options.Key, err = asResourceKey(user.GetNamespace(), "dashboards")
		// Currently a search query is across folders and dashboards
		if searchRequest.Query != "" {
			federate, err = asResourceKey(user.GetNamespace(), "folders")
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
			s := &resource.ResourceSearchRequest_Sort{Field: sort}
			if strings.HasPrefix(sort, "-") {
				s.Desc = true
				s.Field = s.Field[1:]
			}
			searchRequest.SortBy = append(searchRequest.SortBy, s)
		}
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

	// The tags filter
	tags, ok := queryParams["tag"]
	if ok {
		searchRequest.Options.Fields = []*resource.Requirement{{
			Key:      "tags",
			Operator: "=",
			Values:   tags,
		}}
	}

	// The names filter
	names, ok := queryParams["name"]
	if ok {
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

	// Run the query
	result, err := s.client.Search(ctx, searchRequest)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	parsedResults, err := dashboardsvc.ParseResults(result, searchRequest.Offset)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	s.write(w, parsedResults)
}

func (s *SearchHandler) write(w http.ResponseWriter, obj any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(obj)
}

// Given a namespace and type convert it to a search key
func asResourceKey(ns string, k string) (*resource.ResourceKey, error) {
	if ns == "" {
		return nil, apierrors.NewBadRequest("missing namespace")
	}
	switch k {
	case "folders", "folder":
		return &resource.ResourceKey{
			Namespace: ns,
			Group:     "folder.grafana.app",
			Resource:  "folders",
		}, nil
	case "dashboards", "dashboard":
		return &resource.ResourceKey{
			Namespace: ns,
			Group:     dashboardv0alpha1.GROUP,
			Resource:  "dashboards",
		}, nil

	// NOT really supported in the dashboard search UI, but useful for manual testing
	case "playlist", "playlists":
		return &resource.ResourceKey{
			Namespace: ns,
			Group:     "playlist.grafana.app",
			Resource:  "playlists",
		}, nil
	}
	return nil, apierrors.NewBadRequest("unknown resource type")
}
