package userpermissions

import (
	"encoding/json"
	"fmt"
	"net/http"

	authlib "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"
	common "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

const userPermissionsDelegatedGrant = "authz.grafana.app/userpermissions:get"
const currentUserPermissionsPath = "whoami/permissions"

// Handler serves the current identity's effective permissions.
type Handler struct {
	client            authlib.UserPermissionsClient
	useExternalGroups bool
}

// NewHandler creates a current-user permissions handler backed by AuthZ.
func NewHandler(client authlib.UserPermissionsClient, useExternalGroups bool) *Handler {
	return &Handler{client: client, useExternalGroups: useExternalGroups}
}

// GetAPIRoutes returns the current-user permissions route.
func (h *Handler) GetAPIRoutes(_ map[string]common.OpenAPIDefinition) *builder.APIRoutes {
	route := builder.APIRouteHandler{
		Path: currentUserPermissionsPath,
		Spec: &spec3.PathProps{Get: &spec3.Operation{OperationProps: spec3.OperationProps{
			OperationId: "getWhoAmIPermissions",
			Tags:        []string{"User"},
			Description: "Get effective permissions for the currently authenticated identity. Deprecated: do not use for new integrations.",
			Deprecated:  true,
			Responses: &spec3.Responses{ResponsesProps: spec3.ResponsesProps{StatusCodeResponses: map[int]*spec3.Response{
				200: {ResponseProps: spec3.ResponseProps{Content: map[string]*spec3.MediaType{
					"application/json": {MediaTypeProps: spec3.MediaTypeProps{Schema: &spec.Schema{SchemaProps: spec.SchemaProps{
						Ref: spec.MustCreateRef("#/components/schemas/" + iam.UserPermissions{}.OpenAPIModelName()),
					}}}},
				}}},
			}}},
		}}},
		Handler: h.handle,
	}
	legacyOperation := *route.Spec.Get
	legacyOperation.OperationId = "getCurrentUserPermissions"
	legacyOperation.Parameters = []*spec3.Parameter{{ParameterProps: spec3.ParameterProps{
		Name: "namespace", In: "path", Required: true, Description: "workspace", Schema: spec.StringProperty(),
	}}}
	return &builder.APIRoutes{
		Root: []builder.APIRouteHandler{route},
		Namespace: []builder.APIRouteHandler{{
			Path:    "users/~/permissions",
			Spec:    &spec3.PathProps{Get: &legacyOperation},
			Handler: h.handleNamespaced,
		}},
	}
}

func (h *Handler) handle(w http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	info, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		errhttp.Write(ctx, apierrors.NewUnauthorized("missing auth info"), w)
		return
	}

	h.writePermissions(w, req, info, info.GetNamespace())
}

func (h *Handler) handleNamespaced(w http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	info, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		errhttp.Write(ctx, apierrors.NewUnauthorized("missing auth info"), w)
		return
	}
	namespace := genericapirequest.NamespaceValue(ctx)
	if !authlib.NamespaceMatches(info.GetNamespace(), namespace) {
		errhttp.Write(ctx, apierrors.NewForbidden(iam.Resource("users"), "~", fmt.Errorf("identity namespace does not match request namespace")), w)
		return
	}
	h.writePermissions(w, req, info, namespace)
}

func (h *Handler) writePermissions(w http.ResponseWriter, req *http.Request, info authlib.AuthInfo, namespace string) {
	ctx := req.Context()
	groups := info.GetGroups()
	if h.useExternalGroups {
		if externalGroupsInfo, ok := info.(interface{ GetExternalGroups() []string }); ok {
			groups = externalGroupsInfo.GetExternalGroups()
		}
	}

	response, err := h.client.GetUserPermissions(ctx, delegatedAuthInfo{AuthInfo: info, groups: groups}, authlib.GetUserPermissionsRequest{
		Namespace: namespace,
	})
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	permissions := make([]iam.UserPermission, 0, len(response.Permissions))
	for _, permission := range response.Permissions {
		permissions = append(permissions, iam.UserPermission{Action: permission.Action, Scope: permission.Scope})
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(iam.UserPermissions{Permissions: permissions})
}

type delegatedAuthInfo struct {
	authlib.AuthInfo
	groups []string
}

func (i delegatedAuthInfo) GetGroups() []string {
	return i.groups
}

func (delegatedAuthInfo) GetTokenDelegatedPermissions() []string {
	return []string{userPermissionsDelegatedGrant}
}
