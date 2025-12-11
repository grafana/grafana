package user

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"go.opentelemetry.io/otel/trace"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

const maxLimit = 100

type SearchHandler struct {
	log      *slog.Logger
	client   resourcepb.ResourceIndexClient
	tracer   trace.Tracer
	features featuremgmt.FeatureToggles
	cfg      *setting.Cfg
}

func NewSearchHandler(tracer trace.Tracer, searchClient resourcepb.ResourceIndexClient, features featuremgmt.FeatureToggles, cfg *setting.Cfg) *SearchHandler {
	return &SearchHandler{
		client:   searchClient,
		log:      slog.Default().With("logger", "grafana-apiserver.user.search"),
		tracer:   tracer,
		features: features,
		cfg:      cfg,
	}
}

func (s *SearchHandler) GetAPIRoutes(defs map[string]common.OpenAPIDefinition) *builder.APIRoutes {
	searchResults := defs["github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.GetSearchUsers"].Schema
	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "searchUsers",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Description: "User search",
							Tags:        []string{"Search"},
							OperationId: "getSearchUsers",
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
										Example:     30,
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

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		errhttp.Write(ctx, fmt.Errorf("no identity found for request: %w", err), w)
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
	limit := int64(30)
	if limitStr != "" {
		if l, err := strconv.ParseInt(limitStr, 10, 64); err == nil && l > 0 {
			if l > maxLimit {
				limit = maxLimit
			} else {
				limit = l
			}
		}
	}

	// Escape characters that are used by bleve wildcard search to be literal strings.
	rawQuery := escapeBleveQuery(queryParams.Get("query"))

	searchQuery := fmt.Sprintf(`*%s*`, rawQuery)

	userGvr := iamv0.UserResourceInfo.GroupResource()
	request := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:     userGvr.Group,
				Resource:  userGvr.Resource,
				Namespace: requester.GetNamespace(),
			},
		},
		Query:  searchQuery,
		Fields: []string{resource.SEARCH_FIELD_TITLE, fieldEmail, fieldLogin, fieldLastSeenAt, fieldRole},
		Limit:  limit,
		Page:   page,
		Offset: (page - 1) * limit,
	}

	if !requester.GetIsGrafanaAdmin() {
		// FIXME: Use the new config service instead of the legacy one
		hiddenUsers := []string{}
		for user := range s.cfg.HiddenUsers {
			if user != requester.GetUsername() {
				hiddenUsers = append(hiddenUsers, user)
			}
		}
		if len(hiddenUsers) > 0 {
			request.Options.Fields = append(request.Options.Fields, &resourcepb.Requirement{
				Key:      fieldLogin,
				Operator: string(selection.NotIn),
				Values:   hiddenUsers,
			})
		}
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

	result, err := ParseResults(resp)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}
	s.write(w, result)
}

func (s *SearchHandler) write(w http.ResponseWriter, obj any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(obj); err != nil {
		s.log.Error("failed to encode JSON response", "error", err)
	}
}

func ParseResults(result *resourcepb.ResourceSearchResponse) (*iamv0.GetSearchUsers, error) {
	if result == nil {
		return iamv0.NewGetSearchUsers(), nil
	} else if result.Error != nil {
		return iamv0.NewGetSearchUsers(), fmt.Errorf("%d error searching: %s: %s", result.Error.Code, result.Error.Message, result.Error.Details)
	} else if result.Results == nil {
		return iamv0.NewGetSearchUsers(), nil
	}

	titleIDX := -1
	emailIDX := -1
	loginIDX := -1
	lastSeenAtIDX := -1
	roleIDX := -1

	for i, v := range result.Results.Columns {
		switch v.Name {
		case resource.SEARCH_FIELD_TITLE:
			titleIDX = i
		case builders.USER_EMAIL:
			emailIDX = i
		case builders.USER_LOGIN:
			loginIDX = i
		case builders.USER_LAST_SEEN_AT:
			lastSeenAtIDX = i
		case builders.USER_ROLE:
			roleIDX = i
		}
	}

	sr := iamv0.NewGetSearchUsers()
	sr.TotalHits = result.TotalHits
	sr.QueryCost = result.QueryCost
	sr.MaxScore = result.MaxScore
	sr.Hits = make([]iamv0.UserHit, 0, len(result.Results.Rows))

	for _, row := range result.Results.Rows {
		if len(row.Cells) != len(result.Results.Columns) {
			return iamv0.NewGetSearchUsers(), fmt.Errorf("error parsing user search response: mismatch number of columns and cells")
		}

		var login string
		if loginIDX >= 0 && row.Cells[loginIDX] != nil {
			login = string(row.Cells[loginIDX])
		}

		hit := iamv0.UserHit{
			Name:  row.Key.Name,
			Login: login,
		}

		if titleIDX >= 0 && row.Cells[titleIDX] != nil {
			hit.Title = string(row.Cells[titleIDX])
		}

		if emailIDX >= 0 && row.Cells[emailIDX] != nil {
			hit.Email = string(row.Cells[emailIDX])
		}

		if roleIDX >= 0 && row.Cells[roleIDX] != nil {
			hit.Role = string(row.Cells[roleIDX])
		}

		if lastSeenAtIDX >= 0 && row.Cells[lastSeenAtIDX] != nil {
			if len(row.Cells[lastSeenAtIDX]) == 8 {
				hit.LastSeenAt = int64(binary.BigEndian.Uint64(row.Cells[lastSeenAtIDX]))
				hit.LastSeenAtAge = util.GetAgeString(time.Unix(hit.LastSeenAt, 0))
			}
		}

		sr.Hits = append(sr.Hits, hit)
	}

	return sr, nil
}

var bleveEscapeRegex = regexp.MustCompile(`([\\*?])`)

func escapeBleveQuery(query string) string {
	return bleveEscapeRegex.ReplaceAllString(query, `\$1`)
}
