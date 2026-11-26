package pluginaccesscontrol

import (
	"context"
	"errors"
	"testing"

	"github.com/fullstorydev/grpchan/inprocgrpc"
	authnlib "github.com/grafana/authlib/authn"
	authzlib "github.com/grafana/authlib/authz"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type appAccessAuthzServer struct {
	authzv1.UnimplementedAuthzServiceServer
	requests []*authzv1.CheckRequest
	allowed  bool
	err      error
}

func (s *appAccessAuthzServer) Check(_ context.Context, req *authzv1.CheckRequest) (*authzv1.CheckResponse, error) {
	s.requests = append(s.requests, req)
	return &authzv1.CheckResponse{Allowed: s.allowed}, s.err
}

// The checker runs through authlib's real client, which applies its own
// delegated-permission gate before calling AuthZ.
func TestNewAppAccessCheckerWithClient(t *testing.T) {
	require.Nil(t, NewAppAccessCheckerWithClient(nil))

	errCheck := errors.New("authz unavailable")
	for _, tc := range []struct {
		name        string
		identity    types.IdentityType
		verb        string
		namespace   string
		permissions []string
		allowed     bool
		checkErr    error
		want        authorizer.Decision
		wantErr     error
		wantCheck   bool
	}{
		{name: "user without delegated permissions", identity: types.TypeUser, verb: "get", namespace: "stacks-1", allowed: true, want: authorizer.DecisionAllow, wantCheck: true},
		{name: "user write needs app access only", identity: types.TypeUser, verb: "create", namespace: "stacks-1", allowed: true, want: authorizer.DecisionAllow, wantCheck: true},
		{name: "service account", identity: types.TypeServiceAccount, verb: "get", namespace: "stacks-1", allowed: true, want: authorizer.DecisionAllow, wantCheck: true},
		{name: "app access denied", identity: types.TypeUser, verb: "get", namespace: "stacks-1", want: authorizer.DecisionDeny, wantCheck: true},
		{name: "authz unavailable", identity: types.TypeUser, verb: "get", namespace: "stacks-1", checkErr: errCheck, want: authorizer.DecisionDeny, wantCheck: true},
		{name: "namespace mismatch", identity: types.TypeUser, verb: "get", namespace: "stacks-2", allowed: true, want: authorizer.DecisionDeny, wantErr: authzlib.ErrNamespaceMismatch},
		{name: "no namespace", identity: types.TypeUser, verb: "get", allowed: true, want: authorizer.DecisionDeny},
		{name: "wildcard namespace", identity: types.TypeUser, verb: "get", namespace: "*", allowed: true, want: authorizer.DecisionDeny},
		{name: "access policy allowed by token", identity: types.TypeAccessPolicy, verb: "get", namespace: "stacks-1", permissions: []string{"example-app/app:get"}, want: authorizer.DecisionAllow},
		{name: "access policy lacks verb", identity: types.TypeAccessPolicy, verb: "create", namespace: "stacks-1", permissions: []string{"example-app/app:get"}, allowed: true, want: authorizer.DecisionDeny},
		{name: "access policy lacks app", identity: types.TypeAccessPolicy, verb: "get", namespace: "stacks-1", permissions: []string{"other-app/app:get"}, allowed: true, want: authorizer.DecisionDeny},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := &appAccessAuthzServer{allowed: tc.allowed, err: tc.checkErr}
			channel := &inprocgrpc.Channel{}
			authzv1.RegisterAuthzServiceServer(channel, server)
			check := NewAppAccessCheckerWithClient(authzlib.NewClient(channel))
			user := &identity.StaticRequester{Type: tc.identity, UserUID: "reader", Namespace: "stacks-1", OrgID: 1,
				Groups:            []string{"team-1"},
				AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{Rest: authnlib.AccessTokenClaims{Permissions: tc.permissions}},
			}
			if tc.namespace == "*" {
				user.Namespace = "*"
			}
			// The namespace comes from RequestInfo, as it does before the apiserver sets it.
			ctx := request.WithRequestInfo(t.Context(), &request.RequestInfo{Namespace: tc.namespace, Verb: tc.verb})

			decision, _, err := check(ctx, user, "example-app")

			require.Equal(t, tc.want, decision)
			switch {
			case tc.checkErr != nil:
				require.ErrorContains(t, err, tc.checkErr.Error())
			case tc.wantErr != nil:
				require.ErrorIs(t, err, tc.wantErr)
			default:
				require.NoError(t, err)
			}
			require.Empty(t, user.GetTokenDelegatedPermissions(), "the requester's credentials must not change")
			if !tc.wantCheck {
				require.Empty(t, server.requests)
				return
			}
			// Every verb needs app access, which AuthZ maps from get on the settings object.
			require.Len(t, server.requests, 1)
			got := server.requests[0]
			require.Equal(t, user.GetUID(), got.Subject)
			require.Equal(t, user.Groups, got.Teams)
			require.Equal(t, tc.namespace, got.Namespace)
			require.Equal(t, "plugins.grafana.app", got.Group)
			require.Equal(t, "app", got.Resource)
			require.Equal(t, "example-app", got.Name)
			require.Equal(t, "get", got.Verb)
			require.Empty(t, got.Subresource)
		})
	}
}
