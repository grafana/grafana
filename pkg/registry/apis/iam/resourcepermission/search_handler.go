package resourcepermission

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/endpoints/request"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	iamauthorizer "github.com/grafana/grafana/pkg/registry/apis/iam/authorizer"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// Query parameter names for GET .../resourcepermissions/search.
const (
	SearchParamUserUID   = "userUID"
	SearchParamTeamUID   = "teamUID"
	SearchParamBasicRole = "basicRole"
)

// ResourcePermissionsSearchHandler serves GET /apis/iam.grafana.app/v0alpha1/namespaces/{namespace}/resourcepermissions/search.
// It returns direct resource permissions for a user, team, or basic role. Errors when backed by unistore only.
// Permissions are only returned if the user has get_permissions on the target resource OR users.permissions:read.
type ResourcePermissionsSearchHandler struct {
	backend    *ResourcePermSqlBackend
	authorizer *iamauthorizer.ResourcePermissionsAuthorizer
}

// NewResourcePermissionsSearchHandler creates the handler. backend may be nil (unistore only); then DoSearch returns an error.
// When backend is non-nil, authorizer should be provided so results are filtered by get_permissions on each target resource.
func NewResourcePermissionsSearchHandler(backend *ResourcePermSqlBackend, authorizer *iamauthorizer.ResourcePermissionsAuthorizer) *ResourcePermissionsSearchHandler {
	return &ResourcePermissionsSearchHandler{backend: backend, authorizer: authorizer}
}

// GetAPIRoutes returns the route for resourcepermissions/search so the path is
// /apis/iam.grafana.app/v0alpha1/namespaces/{namespace}/resourcepermissions/search.
func (h *ResourcePermissionsSearchHandler) GetAPIRoutes(defs map[string]common.OpenAPIDefinition) *builder.APIRoutes {
	if h == nil {
		return &builder.APIRoutes{}
	}
	var responseSchema spec.Schema
	if def, ok := defs["github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.PermissionsSearchResult"]; ok && def.Schema.Ref.String() != "" {
		responseSchema = spec.Schema{SchemaProps: spec.SchemaProps{Ref: def.Schema.Ref}}
	} else {
		responseSchema = spec.Schema{SchemaProps: spec.SchemaProps{Type: []string{"object"}}}
	}
	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "resourcepermissions/search",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							OperationId: "searchResourcePermissions",
							Tags:        []string{"ResourcePermission"},
							Description: "Search direct resource permissions by subject. Returns permissions for the given user, team, or basic role.",
							Parameters: []*spec3.Parameter{
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "namespace",
										In:          "path",
										Required:    true,
										Description: "Namespace (org scope)",
										Schema:      spec.StringProperty(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        SearchParamUserUID,
										In:          "query",
										Required:    false,
										Description: "User UID to list direct resource permissions for",
										Schema:      spec.StringProperty(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        SearchParamTeamUID,
										In:          "query",
										Required:    false,
										Description: "Team UID to list direct resource permissions for",
										Schema:      spec.StringProperty(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        SearchParamBasicRole,
										In:          "query",
										Required:    false,
										Description: "Basic org role to list direct resource permissions for (e.g. Viewer, Editor, Admin)",
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
															Schema: &responseSchema,
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
				Handler: h.DoSearch,
			},
		},
	}
}

// DoSearch handles GET .../namespaces/{namespace}/resourcepermissions/search
// Accepted query params (exactly one required):
//   - userUID: user UID to search direct permissions for
//   - teamUID: team UID
//   - basicRole: basic org role name (e.g. Viewer, Editor, Admin)
//
// Authorization: same as Get/List — only returns permissions for resources the caller has get_permissions on, unless the user has users.permissions:read.
func (h *ResourcePermissionsSearchHandler) DoSearch(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if h.backend == nil {
		errhttp.Write(ctx, errors.New("search is not available: resourcepermissions are backed by unistore only; legacy SQL backend is required"), w)
		return
	}
	if h.authorizer == nil {
		errhttp.Write(ctx, errors.New("authorizer is required"), w)
		return
	}
	_, ok := types.AuthInfoFrom(ctx)
	if !ok {
		errhttp.Write(ctx, apierrors.NewUnauthorized("unauthenticated"), w)
		return
	}
	vars := mux.Vars(r)
	namespace := vars["namespace"]
	if namespace == "" {
		errhttp.Write(ctx, errutil.BadRequest("resourcepermission.search.namespaceRequired").Errorf("namespace is required"), w)
		return
	}
	ctx = request.WithNamespace(ctx, namespace)

	q := r.URL.Query()
	userUID := q.Get(SearchParamUserUID)
	teamUID := q.Get(SearchParamTeamUID)
	basicRole := q.Get(SearchParamBasicRole)

	var subjectUID string
	providedSubjects := 0
	for _, s := range []string{userUID, teamUID, basicRole} {
		if s == "" {
			continue
		}
		providedSubjects++
		subjectUID = s
	}
	if providedSubjects == 0 {
		errhttp.Write(ctx, errutil.BadRequest("resourcepermission.search.subjectRequired").Errorf("exactly one of userUID, teamUID, or basicRole query parameters is required"), w)
		return
	}
	if providedSubjects > 1 {
		errhttp.Write(ctx, errutil.BadRequest("resourcepermission.search.multipleSubjects").Errorf("only one of userUID, teamUID, or basicRole query parameters may be provided"), w)
		return
	}

	permissions, err := h.backend.ListDirectPermissionsForSubject(ctx, namespace, subjectUID)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}
	permissions = filterPermissionsByGet(ctx, namespace, permissions, h.backend, h.authorizer)
	result := &iamv0.PermissionsSearchResult{
		Permissions: permissions,
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

// filterPermissionsByGet returns only permissions for which the caller has get_permissions on the target resource.
func filterPermissionsByGet(
	ctx context.Context,
	namespace string,
	perms []iamv0.PermissionSpec,
	backend *ResourcePermSqlBackend,
	authorizer *iamauthorizer.ResourcePermissionsAuthorizer,
) []iamv0.PermissionSpec {
	if backend == nil || authorizer == nil || len(perms) == 0 {
		return []iamv0.PermissionSpec{}
	}
	authInfo, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return nil
	}
	ns, err := types.ParseNamespace(namespace)
	if err != nil {
		return nil
	}
	filtered, err := iamauthorizer.CanViewTargets(authorizer, ctx, authInfo, perms, func(i int) (string, string, string, string, bool) {
		// ParseScopeCtx translates id-scoped names (e.g. serviceaccounts:id:123) to UIDs so
		// that CanViewTargets receives a K8s-compatible name rather than a numeric DB id.
		grn, err := backend.ParseScopeCtx(ctx, ns, perms[i].Scope, "")
		if err != nil {
			return "", "", "", "", false
		}
		return namespace, grn.Group, grn.Resource, grn.Name, true
	})
	if err != nil {
		return nil
	}
	return filtered
}
