package iam

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"

	"github.com/grafana/authlib/authz"
	authlib "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/errgroup"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/endpoints/request"
	k8srest "k8s.io/apiserver/pkg/registry/rest"
	k8scommon "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	teamsearch "github.com/grafana/grafana/pkg/services/team/search"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

const maxIDFilterValues = 100

// accessControlCheck maps a legacy RBAC action name to a K8s-style check.
// The RBAC authz server translates Group/Resource/Verb through the mapper
// to resolve the underlying RBAC action.
type teamAccessControlCheck struct {
	action   string // legacy RBAC action name returned to callers
	group    string
	resource string
	verb     string
	name     string // team UID of the resource being checked
}

var teamAccessControlChecks = []teamAccessControlCheck{
	{action: "teams:read", group: iamv0alpha1.GROUP, resource: "teams", verb: utils.VerbList},
	{action: "teams:write", group: iamv0alpha1.GROUP, resource: "teams", verb: utils.VerbUpdate},
	{action: "teams:delete", group: iamv0alpha1.GROUP, resource: "teams", verb: utils.VerbDelete},
	{action: "teams.permissions:read", group: iamv0alpha1.GROUP, resource: "teams", verb: utils.VerbGetPermissions},
	{action: "teams.permissions:write", group: iamv0alpha1.GROUP, resource: "teams", verb: utils.VerbSetPermissions},
	{action: "teams.roles:read", group: iamv0alpha1.GROUP, resource: "rolebindings", verb: utils.VerbList},
}

type TeamSearchHandler struct {
	log              log.Logger
	client           resourcepb.ResourceIndexClient
	tracer           trace.Tracer
	features         featuremgmt.FeatureToggles
	accessClient     authlib.AccessClient
	teamBindingStore k8srest.Lister
}

func NewTeamSearchHandler(tracer trace.Tracer, dual dualwrite.Service, legacyTeamSearcher resourcepb.ResourceIndexClient, resourceClient resource.ResourceClient, features featuremgmt.FeatureToggles, accessClient authlib.AccessClient) *TeamSearchHandler {
	searchClient := resource.NewSearchClient(dualwrite.NewSearchAdapter(dual), iamv0alpha1.TeamResourceInfo.GroupResource(), resourceClient, legacyTeamSearcher)

	return &TeamSearchHandler{
		client:       searchClient,
		log:          log.New("grafana-apiserver.teams.search"),
		tracer:       tracer,
		features:     features,
		accessClient: accessClient,
	}
}

func (s *TeamSearchHandler) GetAPIRoutes(defs map[string]k8scommon.OpenAPIDefinition) *builder.APIRoutes {
	searchResults := defs["github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.GetSearchTeams"].Schema

	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "searchTeams",
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
										Description: "team name query string (fuzzy/partial match). Mutually exclusive with title.",
										Required:    false,
										Schema:      spec.StringProperty(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "title",
										In:          "query",
										Description: "exact match on team name. Mutually exclusive with query.",
										Required:    false,
										Schema:      spec.StringProperty(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "uid",
										In:          "query",
										Description: "filter by team UIDs. Mutually exclusive with teamId.",
										Required:    false,
										Schema:      spec.ArrayProperty(spec.StringProperty()),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "teamId",
										In:          "query",
										Description: "filter by legacy team IDs. Deprecated: use uid instead. Mutually exclusive with uid.",
										Required:    false,
										Deprecated:  true,
										Schema:      spec.ArrayProperty(spec.Int64Property()),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "limit",
										In:          "query",
										Description: "limit the number of results",
										Required:    false,
										Schema:      spec.Int64Property(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "offset",
										In:          "query",
										Description: "start the query at the given offset",
										Required:    false,
										Schema:      spec.Int64Property(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "page",
										In:          "query",
										Description: "page number to start from",
										Required:    false,
										Schema:      spec.Int64Property(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "membercount",
										In:          "query",
										Description: "when true, includes member count for each team in the response",
										Required:    false,
										Schema:      spec.BoolProperty(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "accesscontrol",
										In:          "query",
										Description: "when true, includes access control metadata in the response",
										Required:    false,
										Schema:      spec.BoolProperty(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "sort",
										In:          "query",
										Description: "sortable field",
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
				Handler: s.DoTeamSearch,
			},
		},
	}
}

// nolint:gocyclo
func (s *TeamSearchHandler) DoTeamSearch(w http.ResponseWriter, r *http.Request) {
	ctx, span := s.tracer.Start(r.Context(), "team.search")
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

	limit := common.DefaultListLimit
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

	if limit > common.MaxListLimit {
		http.Error(w, fmt.Sprintf("limit parameter exceeds maximum of %d", common.MaxListLimit), http.StatusBadRequest)
		return
	}

	if limit < 1 {
		limit = common.DefaultListLimit
	}

	searchRequest := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:     iamv0alpha1.TeamResourceInfo.GroupResource().Group,
				Resource:  iamv0alpha1.TeamResourceInfo.GroupResource().Resource,
				Namespace: requester.GetNamespace(),
			},
		},
		Query:   queryParams.Get("query"),
		Limit:   int64(limit),
		Offset:  int64(offset),
		Page:    int64(page),
		Explain: queryParams.Has("explain") && queryParams.Get("explain") != "false",
		Fields: []string{
			resource.SEARCH_FIELD_TITLE,
			resource.SEARCH_FIELD_PREFIX + builders.TEAM_SEARCH_EMAIL,
			resource.SEARCH_FIELD_PREFIX + builders.TEAM_SEARCH_PROVISIONED,
			resource.SEARCH_FIELD_PREFIX + builders.TEAM_SEARCH_EXTERNAL_UID,
		},
	}

	if queryParams.Has("sort") {
		for _, sortParam := range queryParams["sort"] {
			currField := sortParam
			desc := false
			if strings.HasPrefix(sortParam, "-") {
				currField = sortParam[1:]
				desc = true
			}

			if currField != resource.SEARCH_FIELD_TITLE && !slices.Contains(builders.TeamSortableExtraFields, currField) {
				http.Error(w, fmt.Sprintf("invalid sort field: %s", currField), http.StatusBadRequest)
				return
			}

			sortField := currField
			if slices.Contains(builders.TeamSortableExtraFields, currField) {
				sortField = resource.SEARCH_FIELD_PREFIX + currField
			}

			s := &resourcepb.ResourceSearchRequest_Sort{
				Field: sortField,
				Desc:  desc,
			}
			searchRequest.SortBy = append(searchRequest.SortBy, s)
		}
	}

	if title := queryParams.Get("title"); title != "" {
		if searchRequest.Query != "" {
			http.Error(w, "query and title parameters are mutually exclusive", http.StatusBadRequest)
			return
		}
		searchRequest.Options.Fields = append(searchRequest.Options.Fields, &resourcepb.Requirement{
			Key:      resource.SEARCH_FIELD_TITLE,
			Operator: string(selection.DoubleEquals), // exact match on title
			Values:   []string{title},
		})
	}

	uids := queryParams["uid"]
	teamIds := queryParams["teamId"]
	if len(uids) > 0 && len(teamIds) > 0 {
		http.Error(w, "uid and teamId parameters are mutually exclusive", http.StatusBadRequest)
		return
	}
	if len(uids) > maxIDFilterValues {
		http.Error(w, fmt.Sprintf("uid parameter exceeds maximum of %d values", maxIDFilterValues), http.StatusBadRequest)
		return
	}
	if len(teamIds) > maxIDFilterValues {
		http.Error(w, fmt.Sprintf("teamId parameter exceeds maximum of %d values", maxIDFilterValues), http.StatusBadRequest)
		return
	}
	for _, id := range teamIds {
		if _, err := strconv.ParseInt(id, 10, 64); err != nil {
			http.Error(w, fmt.Sprintf("invalid teamId value %q: must be an integer", id), http.StatusBadRequest)
			return
		}
	}

	// Team UIDs in the legacy store maps to the name field in the unified store.
	if len(uids) > 0 {
		searchRequest.Options.Fields = append(searchRequest.Options.Fields, &resourcepb.Requirement{
			Key:      resource.SEARCH_FIELD_NAME,
			Operator: string(selection.In),
			Values:   uids,
		})
	}

	if len(teamIds) > 0 {
		searchRequest.Options.Labels = append(searchRequest.Options.Labels, &resourcepb.Requirement{
			Key:      resource.SEARCH_FIELD_LEGACY_ID,
			Operator: string(selection.In),
			Values:   teamIds,
		})
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

	if queryParams.Get("membercount") == "true" && s.teamBindingStore != nil {
		if err := s.enrichWithMemberCounts(ctx, requester.GetNamespace(), searchResults.Hits); err != nil {
			errhttp.Write(ctx, err, w)
			return
		}
	}

	if queryParams.Get("accesscontrol") == "true" && s.accessClient != nil {
		if err := s.stampAccessControl(ctx, requester, searchResults.Hits); err != nil {
			span.RecordError(err)
			s.log.Warn("failed to get access control metadata", "error", err)
		}
	}

	if err := s.write(w, searchResults); err != nil {
		s.log.Error("failed to write team search results", "error", err)
		errhttp.Write(ctx, err, w)
		return
	}
}

func (s *TeamSearchHandler) stampAccessControl(ctx context.Context, requester identity.Requester, hits []iamv0alpha1.GetSearchTeamsTeamHit) error {
	namespace := requester.GetNamespace()

	items := func(yield func(teamAccessControlCheck) bool) {
		for _, hit := range hits {
			for _, c := range teamAccessControlChecks {
				c.name = hit.Name
				if !yield(c) {
					return
				}
			}
		}
	}

	extractFn := func(c teamAccessControlCheck) authz.BatchCheckItem {
		return authz.BatchCheckItem{
			Verb:      c.verb,
			Group:     c.group,
			Resource:  c.resource,
			Namespace: namespace,
			Name:      c.name,
		}
	}

	acMap := make(map[string]map[string]bool, len(hits))
	for c, err := range authz.FilterAuthorized(ctx, s.accessClient, items, extractFn, authz.WithTracer(s.tracer)) {
		if err != nil {
			return fmt.Errorf("access control check failed: %w", err)
		}
		if acMap[c.name] == nil {
			acMap[c.name] = make(map[string]bool, len(teamAccessControlChecks))
		}
		acMap[c.name][c.action] = true
	}

	for i := range hits {
		hits[i].AccessControl = acMap[hits[i].Name]
	}

	return nil
}

// enrichWithMemberCounts fetches member counts for each team hit concurrently.
// errgroup is used as a bounded concurrency pool (SetLimit); the first error
// from any goroutine is propagated to the caller.
func (s *TeamSearchHandler) enrichWithMemberCounts(ctx context.Context, namespace string, hits []iamv0alpha1.GetSearchTeamsTeamHit) error {
	if len(hits) == 0 {
		return nil
	}

	var g errgroup.Group
	g.SetLimit(10)

	for i := range hits {
		g.Go(func() error {
			outgoingCtx := request.WithNamespace(ctx, namespace)
			obj, err := s.teamBindingStore.List(outgoingCtx, &internalversion.ListOptions{
				FieldSelector: fields.OneTermEqualSelector("spec.teamRef.name", hits[i].Name),
			})
			if err != nil {
				return fmt.Errorf("failed to list team bindings for team %s: %w", hits[i].Name, err)
			}
			list, ok := obj.(*iamv0alpha1.TeamBindingList)
			if !ok {
				return fmt.Errorf("unexpected type from team binding list for team %s: %T", hits[i].Name, obj)
			}
			count := int64(len(list.Items))
			hits[i].MemberCount = &count
			return nil
		})
	}

	return g.Wait()
}

func (s *TeamSearchHandler) write(w http.ResponseWriter, obj any) error {
	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(obj)
}
