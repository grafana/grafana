package user

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"

	"github.com/grafana/authlib/authz"
	authlib "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	k8scommon "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// accessControlCheck maps a legacy RBAC action name to a K8s-style check.
// The RBAC authz server translates Group/Resource/Verb through the mapper
// to resolve the underlying RBAC action.
type accessControlCheck struct {
	action   string // legacy RBAC action name returned to callers
	group    string
	resource string
	verb     string
	name     string // user UID of the resource being checked
}

// Only verbs whose relation is defined on the authz model's "user" type may be
// checked here. A check for a relation the type lacks fails the whole batch
// (e.g. "relation 'user#create' not found"), blanking out all access control
// metadata. The "user" type defines only get/update/delete, so VerbCreate
// (org.users:add) and VerbGetPermissions (users.permissions:read) are omitted.
var userAccessControlChecks = []accessControlCheck{
	{action: "org.users:read", group: iamv0.GROUP, resource: "users", verb: utils.VerbList},
	{action: "org.users:remove", group: iamv0.GROUP, resource: "users", verb: utils.VerbDelete},
	{action: "org.users:write", group: iamv0.GROUP, resource: "users", verb: utils.VerbUpdate},
	{action: "users.roles:read", group: iamv0.GROUP, resource: "rolebindings", verb: utils.VerbList},
}

type SearchHandler struct {
	log          log.Logger
	client       *dualwrite.Selector[SearchBackend]
	tracer       trace.Tracer
	accessClient authlib.AccessClient
}

func NewSearchHandler(tracer trace.Tracer, searchClient *dualwrite.Selector[SearchBackend], accessClient authlib.AccessClient) *SearchHandler {
	return &SearchHandler{
		client:       searchClient,
		log:          log.New("grafana-apiserver.users.search"),
		tracer:       tracer,
		accessClient: accessClient,
	}
}

func (s *SearchHandler) GetAPIRoutes(defs map[string]k8scommon.OpenAPIDefinition) *builder.APIRoutes {
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
										Name:        "offset",
										In:          "query",
										Description: "number of results to skip",
										Example:     0,
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

	limit := common.DefaultListLimit
	offset := 0
	page := 1
	if queryParams.Has("limit") {
		limit, _ = strconv.Atoi(queryParams.Get("limit"))
	}
	if queryParams.Has("offset") {
		offset, _ = strconv.Atoi(queryParams.Get("offset"))
		if offset > 0 && limit > 0 {
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

	query := SearchQuery{
		Namespace: requester.GetNamespace(),
		Query:     queryParams.Get("query"),
		Limit:     int64(limit),
		Page:      int64(page),
		Offset:    int64(offset),
		Sort:      queryParams["sort"],
	}
	if !queryParams.Has("sort") {
		query.Sort = []string{"login"}
	}

	span.SetAttributes(attribute.Int("limit", limit),
		attribute.Int("page", page),
		attribute.Int("offset", offset),
		attribute.String("query", query.Query))

	backend, err := s.client.Resolve(ctx)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "user search failed")
		errhttp.Write(ctx, err, w)
		return
	}
	result, err := backend.Search(ctx, query)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "user search failed")
		errhttp.Write(ctx, err, w)
		return
	}

	if queryParams.Get("accesscontrol") == "true" && s.accessClient != nil {
		if err := s.stampAccessControl(ctx, requester, result.Hits); err != nil {
			span.RecordError(err)
			s.log.Warn("failed to get access control metadata", "error", err)
		}
	}

	s.write(w, result)
}

func (s *SearchHandler) stampAccessControl(ctx context.Context, requester identity.Requester, hits []iamv0.GetSearchUsersUserHit) error {
	namespace := requester.GetNamespace()

	items := func(yield func(accessControlCheck) bool) {
		for _, hit := range hits {
			for _, c := range userAccessControlChecks {
				c.name = hit.Name
				if !yield(c) {
					return
				}
			}
		}
	}

	extractFn := func(c accessControlCheck) authz.BatchCheckItem {
		return authz.BatchCheckItem{
			Verb:      c.verb,
			Group:     c.group,
			Resource:  c.resource,
			Namespace: namespace,
			Name:      c.name,
			// Folder is omitted: users are not folder-scoped resources.
			// TODO: set FreshnessTimestamp once we decide whether cached AC is acceptable here.
		}
	}

	acMap := make(map[string]map[string]bool, len(hits))
	for c, err := range authz.FilterAuthorized(ctx, s.accessClient, items, extractFn, authz.WithTracer(s.tracer)) {
		if err != nil {
			return fmt.Errorf("access control check failed: %w", err)
		}
		if acMap[c.name] == nil {
			acMap[c.name] = make(map[string]bool, len(userAccessControlChecks))
		}
		acMap[c.name][c.action] = true
	}

	for i := range hits {
		hits[i].AccessControl = acMap[hits[i].Name]
	}

	return nil
}

func (s *SearchHandler) write(w http.ResponseWriter, obj any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(obj); err != nil {
		s.log.Error("failed to encode JSON response", "error", err)
	}
}
