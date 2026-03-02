package iam

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"

	"github.com/grafana/authlib/authz"
	authlib "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/trace"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	teamsearch "github.com/grafana/grafana/pkg/services/team/search"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

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
	log          log.Logger
	client       resourcepb.ResourceIndexClient
	tracer       trace.Tracer
	features     featuremgmt.FeatureToggles
	accessClient authlib.AccessClient
}

func NewTeamSearchHandler(tracer trace.Tracer, dual dualwrite.Service, legacyTeamSearcher resourcepb.ResourceIndexClient, resourceClient resource.ResourceClient, features featuremgmt.FeatureToggles, accessClient authlib.AccessClient) *TeamSearchHandler {
	searchClient := resource.NewSearchClient(dualwrite.NewSearchAdapter(dual), iamv0alpha1.TeamResourceInfo.GroupResource(), resourceClient, legacyTeamSearcher, features)

	return &TeamSearchHandler{
		client:       searchClient,
		log:          log.New("grafana-apiserver.teams.search"),
		tracer:       tracer,
		features:     features,
		accessClient: accessClient,
	}
}

func (s *TeamSearchHandler) GetAPIRoutes(defs map[string]common.OpenAPIDefinition) *builder.APIRoutes {
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
										Description: "team name query string",
										Required:    false,
										Schema:      spec.StringProperty(),
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
										Name:        "accesscontrol",
										In:          "query",
										Description: "when true, includes access control metadata in the response",
										Required:    false,
										Schema:      spec.BoolProperty(),
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

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		errhttp.Write(ctx, fmt.Errorf("no identity found for request: %w", err), w)
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

func (s *TeamSearchHandler) stampAccessControl(ctx context.Context, requester identity.Requester, hits []iamv0alpha1.TeamHit) error {
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

func (s *TeamSearchHandler) write(w http.ResponseWriter, obj any) error {
	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(obj)
}
