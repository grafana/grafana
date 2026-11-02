package display

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
)

type fakeResolver struct {
	gotKeys []string
	gotNS   string
	result  *iam.DisplayList
	err     error
}

type selfAuthInfo struct {
	authlib.AuthInfo
	identifier string
	uid        string
}

func (a selfAuthInfo) GetIdentifier() string { return a.identifier }
func (a selfAuthInfo) GetUID() string        { return a.uid }

func TestCurrentUserRoutes(t *testing.T) {
	routes := NewDisplayHandler().GetAPIRoutes(nil)
	require.Len(t, routes.Root, 1)
	whoami := routes.Root[0]
	require.Equal(t, "whoami", whoami.Path)
	require.Equal(t, "getWhoAmI", whoami.Spec.Get.OperationId)
	require.Equal(t, []string{"User"}, whoami.Spec.Get.Tags)
	require.False(t, whoami.Spec.Get.Deprecated)
	require.Empty(t, whoami.Spec.Get.Parameters)
	require.Equal(t, "#/components/schemas/"+iam.CurrentUserInfo{}.OpenAPIModelName(),
		whoami.Spec.Get.Responses.StatusCodeResponses[http.StatusOK].Content["application/json"].Schema.Ref.String())

	for _, route := range routes.Namespace {
		if route.Path == "display" {
			require.Equal(t, []string{"Display"}, route.Spec.Get.Tags)
		}
		if route.Path == currentUserPath {
			require.Equal(t, []string{"User"}, route.Spec.Get.Tags)
			require.Equal(t, "getCurrentUserDisplay", route.Spec.Get.OperationId)
			require.True(t, route.Spec.Get.Deprecated)
			require.Contains(t, route.Spec.Get.Description, "/apis/iam.grafana.app/v0alpha1/whoami")
			require.Equal(t, whoami.Spec.Get.Responses, route.Spec.Get.Responses)
			require.Len(t, route.Spec.Get.Parameters, 1)
			require.Equal(t, "namespace", route.Spec.Get.Parameters[0].Name)
			return
		}
	}
	t.Fatal("missing namespaced current-user route")
}

func (f *fakeResolver) GetDisplayList(ctx context.Context, _ authlib.NamespaceInfo, keys []string) (*iam.DisplayList, error) {
	f.gotKeys = keys
	f.gotNS = request.NamespaceValue(ctx)
	if f.err != nil {
		return nil, f.err
	}
	return f.result, nil
}

func selfRequest(t *testing.T, auth authlib.AuthInfo) *http.Request {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/apis/iam.grafana.app/v0alpha1/namespaces/default/users/~", nil)
	if auth != nil {
		req = req.WithContext(authlib.WithAuthInfo(req.Context(), auth))
	}
	return req
}

func TestDisplayHandlersPreserveErrorStatus(t *testing.T) {
	caller := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u1", Namespace: "default"}
	for name, input := range map[string]struct {
		err  error
		code int
	}{
		"typed": {err: apierrors.NewServiceUnavailable("index unavailable"), code: http.StatusServiceUnavailable},
		"plain": {err: errors.New("private database failure"), code: http.StatusInternalServerError},
	} {
		for _, endpoint := range []string{"display", "self"} {
			t.Run(name+"/"+endpoint, func(t *testing.T) {
				h := NewDisplayHandler(&fakeResolver{err: input.err})
				req := httptest.NewRequest(http.MethodGet, "/display?key=user:u1", nil)
				req = req.WithContext(authlib.WithAuthInfo(req.Context(), caller))
				rec := httptest.NewRecorder()
				if endpoint == "display" {
					h.handleDisplay(rec, req)
				} else {
					h.handleSelf(rec, req)
				}
				require.Equal(t, input.code, rec.Code)
				if name == "plain" {
					require.NotContains(t, rec.Body.String(), input.err.Error())
				}
			})
		}
	}
}

func TestDisplayHandler_handleSelf(t *testing.T) {
	caller := &identity.StaticRequester{
		Type:            authlib.TypeUser,
		UserUID:         "u1",
		UserID:          1,
		OrgID:           1,
		OrgRole:         identity.RoleEditor,
		AuthenticatedBy: "oauth_github",
		Email:           "alice@example.com",
		Namespace:       "default",
	}

	t.Run("missing auth info returns 401", func(t *testing.T) {
		h := NewDisplayHandler(&fakeResolver{})
		rec := httptest.NewRecorder()

		h.handleSelf(rec, selfRequest(t, nil))

		require.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	t.Run("caller display is resolved from context and returned", func(t *testing.T) {
		want := iam.CurrentUserInfo{
			Display: iam.Display{
				Identity:    iam.IdentityRef{Type: authlib.TypeUser, Name: "u1"},
				DisplayName: "Alice",
				InternalID:  1,
			},
			AuthenticatedBy: "oauth_github",
			Email:           "alice@example.com",
		}
		resolver := &fakeResolver{result: &iam.DisplayList{Items: []iam.Display{want.Display}}}
		h := NewDisplayHandler(resolver)
		rec := httptest.NewRecorder()

		h.handleSelf(rec, selfRequest(t, caller))

		require.Equal(t, http.StatusOK, rec.Code)
		// The caller identifies itself purely from context, no query input.
		require.Equal(t, []string{"user:u1"}, resolver.gotKeys)
		// The cluster-scoped whoami route provides no namespace, so it must be set from the caller.
		require.Equal(t, "default", resolver.gotNS)

		want.Role = string(identity.RoleEditor)
		want.Namespace = "default"

		var got iam.CurrentUserInfo
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
		require.Equal(t, want, got)
	})

	t.Run("existing matching namespace in context is kept", func(t *testing.T) {
		resolver := &fakeResolver{result: &iam.DisplayList{}}
		req := selfRequest(t, caller)
		req = req.WithContext(request.WithNamespace(req.Context(), "default"))
		rec := httptest.NewRecorder()

		NewDisplayHandler(resolver).handleSelf(rec, req)

		require.Equal(t, "default", resolver.gotNS)
	})

	t.Run("existing mismatched namespace in context is forbidden", func(t *testing.T) {
		resolver := &fakeResolver{result: &iam.DisplayList{}}
		req := selfRequest(t, caller)
		req = req.WithContext(request.WithNamespace(req.Context(), "other"))
		rec := httptest.NewRecorder()

		NewDisplayHandler(resolver).handleSelf(rec, req)

		require.Equal(t, http.StatusForbidden, rec.Code)
		require.Nil(t, resolver.gotKeys)
	})

	t.Run("token identity receives its namespace", func(t *testing.T) {
		caller := authn.NewIDTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{},
			&authn.Claims[authn.IDTokenClaims]{Rest: authn.IDTokenClaims{
				Type: authlib.TypeUser, Identifier: "u1", Namespace: "stacks-123",
				Email: "alice@example.com", AuthenticatedBy: "oauth_github", DisplayName: "Alice",
			}})
		_, isRequester := any(caller).(identity.Requester)
		require.False(t, isRequester)
		want := iam.CurrentUserInfo{Display: iam.Display{Identity: iam.IdentityRef{Type: authlib.TypeUser, Name: "u1"}, DisplayName: "Alice"}}
		resolver := &fakeResolver{result: &iam.DisplayList{Items: []iam.Display{want.Display}}}
		h := NewDisplayHandler(resolver)
		rec := httptest.NewRecorder()

		h.handleSelf(rec, selfRequest(t, caller))

		require.Equal(t, http.StatusOK, rec.Code)
		require.Equal(t, []string{"user:u1"}, resolver.gotKeys)
		want.Namespace = "stacks-123"
		want.Email = "alice@example.com"
		want.AuthenticatedBy = "oauth_github"
		var got iam.CurrentUserInfo
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
		require.Equal(t, want, got)
	})

	for _, namespace := range []string{"default", "", "stacks-invalid"} {
		t.Run("display resolution with namespace "+namespace, func(t *testing.T) {
			caller := &identity.StaticRequester{
				Type: authlib.TypeUser, UserUID: "u1", Name: "Alice", Namespace: namespace,
				Email: "alice@example.com", AuthenticatedBy: "oauth_github", OrgRole: identity.RoleEditor,
			}
			resolver := &fakeResolver{result: &iam.DisplayList{Items: []iam.Display{{
				Identity: iam.IdentityRef{Type: authlib.TypeUser, Name: "u1"},
			}}}}
			h := NewDisplayHandler(resolver)
			rec := httptest.NewRecorder()
			h.handleSelf(rec, selfRequest(t, caller))
			if namespace == "stacks-invalid" {
				require.Equal(t, http.StatusUnauthorized, rec.Code)
				require.Empty(t, resolver.gotKeys)
				return
			}
			require.Equal(t, http.StatusOK, rec.Code)
			var got iam.CurrentUserInfo
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
			require.Equal(t, iam.CurrentUserInfo{
				Display:   iam.Display{Identity: iam.IdentityRef{Type: authlib.TypeUser, Name: "u1"}, DisplayName: "Alice"},
				Namespace: namespace, Email: "alice@example.com", AuthenticatedBy: "oauth_github", Role: "Editor",
			}, got)
			var fields map[string]json.RawMessage
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &fields))
			require.Contains(t, fields, "identity")
			require.Contains(t, fields, "displayName")
			require.NotContains(t, fields, "inline")
		})
	}

	t.Run("enrichment only uses the authenticated identity", func(t *testing.T) {
		matching := iam.Display{
			Identity:    iam.IdentityRef{Type: authlib.TypeUser, Name: "u1"},
			DisplayName: "Alice", AvatarURL: "/avatar/alice", InternalID: 1,
		}
		unrelated := []iam.Display{
			{Identity: iam.IdentityRef{Type: authlib.TypeServiceAccount, Name: "u1"}, DisplayName: "Service account", InternalID: 2},
			{Identity: iam.IdentityRef{Type: authlib.TypeUser, Name: "u2"}, DisplayName: "Bob", InternalID: 3},
		}
		for _, tc := range []struct {
			name    string
			status  int
			results [][]iam.Display
			want    iam.Display
		}{
			{name: "ignores unrelated results", status: http.StatusUnauthorized, results: [][]iam.Display{unrelated}, want: iam.Display{
				Identity: matching.Identity, DisplayName: caller.GetName(),
			}},
			{name: "finds matching result in a batch", status: http.StatusOK, results: [][]iam.Display{append(unrelated, matching)}, want: matching},
			{name: "tries the next resolver", status: http.StatusOK, results: [][]iam.Display{unrelated, {matching}}, want: matching},
		} {
			t.Run(tc.name, func(t *testing.T) {
				resolvers := make([]Resolver, 0, len(tc.results))
				for _, items := range tc.results {
					resolvers = append(resolvers, &fakeResolver{result: &iam.DisplayList{Items: items}})
				}
				h := NewDisplayHandler(resolvers...)
				rec := httptest.NewRecorder()
				h.handleSelf(rec, selfRequest(t, caller))
				require.Equal(t, tc.status, rec.Code)
				var got iam.CurrentUserInfo
				require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
				require.Equal(t, tc.want, got.Display)
			})
		}
	})

	for _, tc := range []struct {
		name       string
		identifier string
		uid        string
	}{
		{name: "empty identifier", uid: "user:"},
		{name: "empty UID", identifier: "u1"},
		{name: "empty identifier and UID"},
	} {
		t.Run(tc.name+" skips enrichment", func(t *testing.T) {
			auth := selfAuthInfo{AuthInfo: caller, identifier: tc.identifier, uid: tc.uid}
			resolver := &fakeResolver{result: &iam.DisplayList{Items: []iam.Display{{
				Identity:    iam.IdentityRef{Type: authlib.TypeUser, Name: tc.identifier},
				DisplayName: "Another user", AvatarURL: "/avatar/another", InternalID: 42,
			}}}}
			rec := httptest.NewRecorder()

			NewDisplayHandler(resolver).handleSelf(rec, selfRequest(t, auth))

			require.Equal(t, http.StatusUnauthorized, rec.Code)
			require.Nil(t, resolver.gotKeys)
			require.NotContains(t, rec.Body.String(), "Another user")
		})
	}

	t.Run("unresolved caller returns identity details with 401", func(t *testing.T) {
		resolver := &fakeResolver{result: &iam.DisplayList{}}
		h := NewDisplayHandler(resolver)
		rec := httptest.NewRecorder()

		h.handleSelf(rec, selfRequest(t, caller))

		require.Equal(t, http.StatusUnauthorized, rec.Code)
		var got iam.CurrentUserInfo
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
		require.Equal(t, iam.CurrentUserInfo{
			Display:   iam.Display{Identity: iam.IdentityRef{Type: authlib.TypeUser, Name: "u1"}, DisplayName: "alice@example.com"},
			Namespace: "default", Role: "Editor", Email: "alice@example.com", AuthenticatedBy: "oauth_github",
		}, got)
	})

	for _, identifier := range []string{"", "0"} {
		t.Run("anonymous identity "+identifier, func(t *testing.T) {
			caller := &identity.StaticRequester{
				Type: authlib.TypeAnonymous, UserUID: identifier, Namespace: "default", OrgRole: identity.RoleViewer,
			}
			resolver := &fakeResolver{err: errors.New("anonymous must not query user records")}
			rec := httptest.NewRecorder()
			NewDisplayHandler(resolver).handleSelf(rec, selfRequest(t, caller))

			require.Equal(t, http.StatusOK, rec.Code)
			require.Nil(t, resolver.gotKeys)
			var got iam.CurrentUserInfo
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
			require.Equal(t, iam.IdentityRef{Type: authlib.TypeAnonymous}, got.Identity)
			require.Equal(t, "Anonymous", got.DisplayName)
			require.NotEmpty(t, got.AvatarURL)
			require.Zero(t, got.InternalID)
			require.Equal(t, "default", got.Namespace)
			require.Equal(t, "Viewer", got.Role)
		})
	}

	t.Run("unresolved access policy returns identity details with 200", func(t *testing.T) {
		caller := &identity.StaticRequester{
			Type: authlib.TypeAccessPolicy, UserUID: "example-app", Name: "example-app", Namespace: "*",
			AuthenticatedBy: "extendedjwt",
		}
		resolver := &fakeResolver{result: &iam.DisplayList{}}
		rec := httptest.NewRecorder()
		NewDisplayHandler(resolver).handleSelf(rec, selfRequest(t, caller))

		require.Equal(t, http.StatusOK, rec.Code)
		require.Equal(t, []string{"access-policy:example-app"}, resolver.gotKeys)
		var got iam.CurrentUserInfo
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))
		require.Equal(t, iam.IdentityRef{Type: authlib.TypeAccessPolicy, Name: "example-app"}, got.Identity)
		require.Equal(t, "example-app", got.DisplayName)
		require.Equal(t, "*", got.Namespace)
		require.Equal(t, "extendedjwt", got.AuthenticatedBy)
	})

	t.Run("resolver error returns 500", func(t *testing.T) {
		resolver := &fakeResolver{err: errors.New("boom")}
		h := NewDisplayHandler(resolver)
		rec := httptest.NewRecorder()

		h.handleSelf(rec, selfRequest(t, caller))

		require.Equal(t, http.StatusInternalServerError, rec.Code)
	})
}
