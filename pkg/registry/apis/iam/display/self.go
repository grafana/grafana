package display

import (
	"encoding/json"
	"fmt"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/userpermissions"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// CurrentUserName is the name token that denotes the calling identity in the "who am I" endpoint.
const CurrentUserName = "~"

// currentUserPath is the route path for the "who am I" endpoint.
const currentUserPath = "users/" + CurrentUserName

// selfRouteSpec describes the current-user endpoint for OpenAPI discovery.
func (r *DisplayHandler) selfRouteSpec() *spec3.PathProps {
	return &spec3.PathProps{
		Get: &spec3.Operation{
			OperationProps: spec3.OperationProps{
				OperationId: "getCurrentUserDisplay",
				Tags:        []string{"User"},
				Description: "Show display information for the currently authenticated identity",
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
					}, {
						ParameterProps: spec3.ParameterProps{
							Name:        "permissions",
							In:          "query",
							Example:     "true",
							Description: "Include permissions in the response (deprecated)",
							Schema:      spec.BoolProperty(),
							Deprecated:  true, // Avoid this for new applications
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
												Schema: &spec.Schema{
													SchemaProps: spec.SchemaProps{
														Ref: spec.MustCreateRef("#/components/schemas/" + iam.CurrentUserInfo{}.OpenAPIModelName()),
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
		},
	}
}

// handleSelf resolves the display information for the caller derived from the request context
func (r *DisplayHandler) handleSelf(w http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	authInfo, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		errhttp.Write(ctx, apierrors.NewUnauthorized("missing auth info"), w)
		return
	}

	rsp := iam.CurrentUserInfo{
		Display: iam.Display{
			Identity: iam.IdentityRef{
				Type: authInfo.GetIdentityType(),
				Name: authInfo.GetIdentifier(),
			},
			DisplayName: authInfo.GetName(),
		},
		Namespace:       authInfo.GetNamespace(),
		Email:           authInfo.GetEmail(),
		AuthenticatedBy: authInfo.GetAuthenticatedBy(),
	}

	if req, ok := authInfo.(identity.Requester); ok {
		rsp.Role = string(req.GetOrgRole())
	}

	w.Header().Set("Content-Type", "application/json")
	// Empty identities cannot establish ownership of a resolver's display row.
	anonymous := authInfo.GetIdentityType() == authlib.TypeAnonymous
	if !anonymous && (rsp.Identity.Name == "" || authInfo.GetUID() == "") {
		errhttp.Write(ctx, apierrors.NewUnauthorized("unable to resolve current identity"), w)
		return
	}

	// Fetch the permissions for the current user
	if req.URL.Query().Get("permissions") == "true" && r.client != nil && rsp.Namespace != "" {
		groups := authInfo.GetGroups()
		if r.useExternalGroups {
			if externalGroupsInfo, ok := authInfo.(interface{ GetExternalGroups() []string }); ok {
				groups = externalGroupsInfo.GetExternalGroups()
			}
		}

		response, err := r.client.GetUserPermissions(ctx, delegatedAuthInfo{
			AuthInfo: authInfo,
			groups:   groups,
		}, authlib.GetUserPermissionsRequest{
			Namespace: rsp.Namespace,
		})
		if err != nil {
			errhttp.Write(ctx, err, w)
			return
		}

		rsp.Permissions = make([]iam.UserPermission, 0, len(response.Permissions))
		for _, permission := range response.Permissions {
			rsp.Permissions = append(rsp.Permissions, iam.UserPermission{Action: permission.Action, Scope: permission.Scope})
		}
	}

	// Anonymous access is established by authentication; it has no user row to resolve.
	if anonymous {
		rsp.Display = parseKeys([]string{string(authlib.TypeAnonymous) + ":"}).disp[0]
		_ = json.NewEncoder(w).Encode(rsp)
		return
	}

	if ns, err := authlib.ParseNamespace(authInfo.GetNamespace()); err == nil {
		// GetUID() is already in the "<type>:<identifier>" form the resolvers expect
		// (e.g. "user:u000000001"), so the caller identifies itself purely from context.
		key := authInfo.GetUID()

		for _, p := range r.resolvers {
			partial, err := p.GetDisplayList(ctx, ns, []string{key})
			if err != nil {
				errhttp.Write(ctx, fmt.Errorf("error calling GetDisplayList %w", err), w) // 500
				return
			}
			for _, item := range partial.Items {
				if item.Identity != rsp.Identity {
					continue
				}
				if item.DisplayName != "" {
					rsp.DisplayName = item.DisplayName
				}
				rsp.AvatarURL = item.AvatarURL
				rsp.InternalID = item.InternalID
				_ = json.NewEncoder(w).Encode(rsp)
				return
			}
		}
	}

	errhttp.Write(ctx, apierrors.NewUnauthorized("unable to resolve current identity"), w)
}

type delegatedAuthInfo struct {
	authlib.AuthInfo
	groups []string
}

func (i delegatedAuthInfo) GetGroups() []string {
	return i.groups
}

func (delegatedAuthInfo) GetTokenDelegatedPermissions() []string {
	return []string{userpermissions.UserPermissionsDelegatedGrant}
}
