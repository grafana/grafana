package user

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"

	"go.opentelemetry.io/otel/trace"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

type SearchHandler struct {
	log      *slog.Logger
	client   resourcepb.ResourceIndexClient
	tracer   trace.Tracer
	features featuremgmt.FeatureToggles
}

func NewSearchHandler(tracer trace.Tracer, searchClient resourcepb.ResourceIndexClient, features featuremgmt.FeatureToggles) *SearchHandler {
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
				Path: "searchUsers",
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
										Required: false,
										Schema:   spec.StringProperty(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "limit",
										In:          "query",
										Description: "number of results to return",
										Example:     10,
										Required:    false,
										Schema:      spec.Int64Property(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "page",
										In:          "query",
										Description: "page number (starting from 1)",
										Example:     1,
										Required:    false,
										Schema:      spec.Int64Property(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "sort",
										In:          "query",
										Description: "sortable field",
										Example:     "",
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
											"lastSeenAt": {
												ExampleProps: spec3.ExampleProps{
													Summary: "last seen at ascending",
													Value:   "lastSeenAt",
												},
											},
											"-lastSeenAt": {
												ExampleProps: spec3.ExampleProps{
													Summary: "last seen at descending",
													Value:   "-lastSeenAt",
												},
											},
											"email": {
												ExampleProps: spec3.ExampleProps{
													Summary: "email ascending",
													Value:   "email",
												},
											},
											"-email": {
												ExampleProps: spec3.ExampleProps{
													Summary: "email descending",
													Value:   "-email",
												},
											},
											"login": {
												ExampleProps: spec3.ExampleProps{
													Summary: "login ascending",
													Value:   "login",
												},
											},
											"-login": {
												ExampleProps: spec3.ExampleProps{
													Summary: "login descending",
													Value:   "-login",
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

	pageStr := queryParams.Get("page")
	page := int64(1)
	if pageStr != "" {
		if p, err := strconv.ParseInt(pageStr, 10, 64); err == nil && p > 0 {
			page = p
		}
	}

	limitStr := queryParams.Get("limit")
	limit := int64(10)
	if limitStr != "" {
		if l, err := strconv.ParseInt(limitStr, 10, 64); err == nil && l > 0 {
			limit = l
		}
	}

	rawQuery := queryParams.Get("query")
	// Escape characters that are used by bleve wildcard search to be literal strings.
	rawQuery = strings.ReplaceAll(rawQuery, "\\", "\\\\")
	rawQuery = strings.ReplaceAll(rawQuery, "*", "\\*")
	rawQuery = strings.ReplaceAll(rawQuery, "?", "\\?")

	searchQuery := fmt.Sprintf(`*%s*`, rawQuery)

	userGvr := iamv0.UserResourceInfo.GroupResource()
	request := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:     userGvr.Group,
				Resource:  userGvr.Resource,
				Namespace: ident.GetNamespace(),
			},
		},
		Query:  searchQuery,
		Fields: []string{resource.SEARCH_FIELD_TITLE, fieldEmail, fieldLogin, fieldLastSeenAt, fieldRole},
		Limit:  limit,
		Offset: (page - 1) * limit,
	}

	if queryParams.Has("sort") {
		for _, sort := range queryParams["sort"] {
			currField := sort
			desc := false
			if strings.HasPrefix(sort, "-") {
				currField = sort[1:]
				desc = true
			}
			if slices.Contains(builders.UserSortableExtraFields, currField) {
				sort = resource.SEARCH_FIELD_PREFIX + currField
			} else {
				sort = currField
			}
			s := &resourcepb.ResourceSearchRequest_Sort{
				Field: sort,
				Desc:  desc,
			}
			request.SortBy = append(request.SortBy, s)
		}
	}

	resp, err := s.client.Search(ctx, request)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	result := iamv0.NewGetSearchUsers()
	result.TotalHits = resp.TotalHits
	result.QueryCost = resp.QueryCost
	result.MaxScore = resp.MaxScore
	result.Hits = make([]iamv0.UserHit, 0, resp.TotalHits)

	if resp.TotalHits > 0 {
		for _, row := range resp.Results.Rows {
			var lastSeenAt int64
			var lastSeenAtAge string

			if len(row.Cells[3]) == 8 {
				lastSeenAt = int64(binary.BigEndian.Uint64(row.Cells[3]))
				lastSeenAtAge = util.GetAgeString(time.Unix(lastSeenAt, 0))
			}

			hit := iamv0.UserHit{
				Name:          row.Key.Name,
				Title:         string(row.Cells[0]),
				Email:         string(row.Cells[1]),
				Login:         string(row.Cells[2]),
				LastSeenAt:    lastSeenAt,
				LastSeenAtAge: lastSeenAtAge,
				Role:          string(row.Cells[4]),
			}
			// TODO: Add a check to filter out hidden users if any (cfg.HiddenUsers)
			result.Hits = append(result.Hits, hit)
		}
	}
	s.write(w, result)
}

func (s *SearchHandler) write(w http.ResponseWriter, obj any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(obj)
}
