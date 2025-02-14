package dashboard

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"sort"
	"strconv"
	"strings"

	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/storage/unified/search"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apis/dashboard"
	dashboardv0alpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	folderv0alpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardsearch "github.com/grafana/grafana/pkg/services/dashboards/service/search"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	foldermodel "github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// The DTO returns everything the UI needs in a single request
type SearchHandler struct {
	log      log.Logger
	client   resource.ResourceIndexClient
	tracer   trace.Tracer
	features featuremgmt.FeatureToggles
}

func NewSearchHandler(tracer trace.Tracer, cfg *setting.Cfg, legacyDashboardSearcher resource.ResourceIndexClient, resourceClient resource.ResourceClient, features featuremgmt.FeatureToggles) *SearchHandler {
	searchClient := resource.NewSearchClient(cfg, setting.UnifiedStorageConfigKeyDashboard, resourceClient, legacyDashboardSearcher)
	return &SearchHandler{
		client:   searchClient,
		log:      log.New("grafana-apiserver.dashboards.search"),
		tracer:   tracer,
		features: features,
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
	names := queryParams["name"]

	// Add the folder constraint. Note this does not do recursive search
	folder := queryParams.Get("folder")
	if folder == foldermodel.SharedWithMeFolderUID {
		dashboardUIDs, err := s.getDashboardsUIDsSharedWithUser(ctx, user)
		if err != nil {
			errhttp.Write(ctx, err, w)
			return
		}

		// hijacks the "name" query param to only search for shared dashboard UIDs
		if len(dashboardUIDs) > 0 {
			names = append(names, dashboardUIDs...)
		}
	} else if folder != "" {
		if folder == rootFolder {
			folder = "" // root folder is empty in the search index
		}
		searchRequest.Options.Fields = []*resource.Requirement{{
			Key:      "folder",
			Operator: "=",
			Values:   []string{folder},
		}}
	}

	if len(names) > 0 {
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

	result, err := s.client.Search(ctx, searchRequest)
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

func (s *SearchHandler) getDashboardsUIDsSharedWithUser(ctx context.Context, user identity.Requester) ([]string, error) {
	if !s.features.IsEnabledGlobally(featuremgmt.FlagUnifiedStorageSearchPermissionFiltering) {
		return []string{}, nil
	}

	// gets dashboards that the user was granted read access to
	permissions := user.GetPermissions()
	dashboardPermissions := permissions[dashboards.ActionDashboardsRead]
	dashboardUids := make([]string, 0)
	sharedDashboards := make([]string, 0)

	for _, dashboardPermission := range dashboardPermissions {
		if dashboardUid, found := strings.CutPrefix(dashboardPermission, dashboards.ScopeDashboardsPrefix); found {
			if !slices.Contains(dashboardUids, dashboardUid) {
				dashboardUids = append(dashboardUids, dashboardUid)
			}
		}
	}

	if len(dashboardUids) == 0 {
		return sharedDashboards, nil
	}

	key, err := asResourceKey(user.GetNamespace(), dashboard.DASHBOARD_RESOURCE)
	if err != nil {
		return sharedDashboards, err
	}

	dashboardSearchRequest := &resource.ResourceSearchRequest{
		Fields: []string{"folder"},
		Limit:  int64(len(dashboardUids)),
		Options: &resource.ListOptions{
			Key: key,
			Fields: []*resource.Requirement{{
				Key:      "name",
				Operator: "in",
				Values:   dashboardUids,
			}},
		},
	}
	// get all dashboards user has access to, along with their parent folder uid
	dashboardResult, err := s.client.Search(ctx, dashboardSearchRequest)
	if err != nil {
		return sharedDashboards, err
	}

	folderUidIdx := -1
	for i, col := range dashboardResult.Results.Columns {
		if col.Name == "folder" {
			folderUidIdx = i
		}
	}

	if folderUidIdx == -1 {
		return sharedDashboards, fmt.Errorf("Error retrieving folder information")
	}

	// populate list of unique folder UIDs in the list of dashboards user has read permissions
	allFolders := make([]string, 0)
	for _, dash := range dashboardResult.Results.Rows {
		folderUid := string(dash.Cells[folderUidIdx])
		if folderUid != "" && !slices.Contains(allFolders, folderUid) {
			allFolders = append(allFolders, folderUid)
		}
	}

	// only folders the user has access to will be returned here
	folderKey, err := asResourceKey(user.GetNamespace(), folderv0alpha1.RESOURCE)
	if err != nil {
		return sharedDashboards, err
	}

	folderSearchRequest := &resource.ResourceSearchRequest{
		Fields: []string{"folder"},
		Limit:  int64(len(allFolders)),
		Options: &resource.ListOptions{
			Key: folderKey,
			Fields: []*resource.Requirement{{
				Key:      "name",
				Operator: "in",
				Values:   allFolders,
			}},
		},
	}
	foldersResult, err := s.client.Search(ctx, folderSearchRequest)
	if err != nil {
		return sharedDashboards, err
	}

	foldersWithAccess := make([]string, 0, len(foldersResult.Results.Rows))
	for _, fold := range foldersResult.Results.Rows {
		foldersWithAccess = append(foldersWithAccess, fold.Key.Name)
	}

	// add to sharedDashboards dashboards user has access to, but does NOT have access to it's parent folder
	for _, dash := range dashboardResult.Results.Rows {
		dashboardUid := dash.Key.Name
		folderUid := string(dash.Cells[folderUidIdx])
		if folderUid != "" && !slices.Contains(foldersWithAccess, folderUid) {
			sharedDashboards = append(sharedDashboards, dashboardUid)
		}
	}
	return sharedDashboards, nil
}
