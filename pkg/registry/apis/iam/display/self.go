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
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// CurrentUserName is the name token that denotes the calling identity in the legacy users/~ endpoint.
const CurrentUserName = "~"

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
	if !ok || authInfo == nil {
		errhttp.Write(ctx, apierrors.NewUnauthorized("missing auth info"), w)
		return
	}

	rsp := iam.CurrentUserInfo{
		Identity: iam.IdentityRef{
			Type: authInfo.GetIdentityType(),
			Name: authInfo.GetIdentifier(),
		},
		DisplayName:     authInfo.GetName(),
		Namespace:       authInfo.GetNamespace(),
		Email:           authInfo.GetEmail(),
		Teams:           authInfo.GetGroups(),
		AuthenticatedBy: authInfo.GetAuthenticatedBy(),
	}

	if requester, ok := authInfo.(identity.Requester); ok {
		rsp.Role = string(requester.GetOrgRole())
	}

	w.Header().Set("Content-Type", "application/json")
	// Empty identities cannot establish ownership of a resolver's display row.
	anonymous := authInfo.GetIdentityType() == authlib.TypeAnonymous
	if !anonymous && (rsp.Identity.Name == "" || authInfo.GetUID() == "") {
		errhttp.Write(ctx, apierrors.NewUnauthorized("unable to resolve current identity"), w)
		return
	}

	// Anonymous access is established by authentication; it has no user row to resolve.
	if anonymous {
		rsp.Display = anonymousDisplay()
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
				errhttp.Write(ctx, fmt.Errorf("error calling GetDisplayList %w", err), w)
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

	// If a user fails to resolve, it should be a 401 response
	if authInfo.GetIdentityType() == authlib.TypeUser {
		w.WriteHeader(http.StatusUnauthorized)
	}

	_ = json.NewEncoder(w).Encode(rsp)
}
