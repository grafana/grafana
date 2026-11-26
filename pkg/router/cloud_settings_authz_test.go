package router

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

type settingsAuthzServer struct {
	authzv1.UnimplementedAuthzServiceServer
	requests []*authzv1.CheckRequest
	allowed  bool
	err      error
}

func (s *settingsAuthzServer) Check(_ context.Context, req *authzv1.CheckRequest) (*authzv1.CheckResponse, error) {
	s.requests = append(s.requests, req)
	return &authzv1.CheckResponse{Allowed: s.allowed}, s.err
}

func TestCloudSettingsAccessCheckerWithAuthlib(t *testing.T) {
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
		wantCheck   bool
	}{
		{name: "user without delegated permissions", identity: types.TypeUser, verb: "get", namespace: "stacks-1", allowed: true, want: authorizer.DecisionAllow, wantCheck: true},
		{name: "user resource write checks app access", identity: types.TypeUser, verb: "create", namespace: "stacks-1", allowed: true, want: authorizer.DecisionAllow, wantCheck: true},
		{name: "service account", identity: types.TypeServiceAccount, verb: "get", namespace: "stacks-1", allowed: true, want: authorizer.DecisionAllow, wantCheck: true},
		{name: "app access denied", identity: types.TypeUser, verb: "get", namespace: "stacks-1", want: authorizer.DecisionDeny, wantCheck: true},
		{name: "authz unavailable", identity: types.TypeUser, verb: "get", namespace: "stacks-1", checkErr: errCheck, want: authorizer.DecisionDeny, wantCheck: true},
		{name: "namespace mismatch", identity: types.TypeUser, verb: "get", namespace: "stacks-2", allowed: true, want: authorizer.DecisionDeny},
		{name: "access policy allowed by token", identity: types.TypeAccessPolicy, verb: "get", namespace: "stacks-1", permissions: []string{"example-app/app:get"}, want: authorizer.DecisionAllow},
		{name: "access policy lacks verb", identity: types.TypeAccessPolicy, verb: "create", namespace: "stacks-1", permissions: []string{"example-app/app:get"}, allowed: true, want: authorizer.DecisionDeny},
		{name: "access policy lacks app", identity: types.TypeAccessPolicy, verb: "get", namespace: "stacks-1", permissions: []string{"other-app/app:get"}, allowed: true, want: authorizer.DecisionDeny},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := &settingsAuthzServer{allowed: tc.allowed, err: tc.checkErr}
			channel := &inprocgrpc.Channel{}
			authzv1.RegisterAuthzServiceServer(channel, server)
			check := cloudSettingsAccessChecker(authzlib.NewClient(channel))
			user := settingsRequester("stacks-1")
			user.Type = tc.identity
			user.Groups = []string{"team-1"}
			user.AccessTokenClaims.Rest.Permissions = tc.permissions
			ctx := request.WithRequestInfo(t.Context(), &request.RequestInfo{Namespace: tc.namespace, Verb: tc.verb})
			ctx = identity.WithRequester(ctx, user)

			decision, _, err := check(ctx, user, "example-app")

			require.Equal(t, tc.want, decision)
			if tc.checkErr != nil {
				require.ErrorContains(t, err, tc.checkErr.Error())
			} else if tc.namespace != user.Namespace {
				require.ErrorIs(t, err, authzlib.ErrNamespaceMismatch)
			} else {
				require.NoError(t, err)
			}
			require.Empty(t, user.GetTokenDelegatedPermissions(), "the requester's credentials must not change")
			if !tc.wantCheck {
				require.Empty(t, server.requests)
				return
			}
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

func TestCloudSettingsAccessChecker(t *testing.T) {
	require.Nil(t, cloudSettingsAccessChecker(nil))

	errCheck := errors.New("authz unavailable")
	accessPolicy := &identity.StaticRequester{Type: types.TypeAccessPolicy, Namespace: "*",
		AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{Rest: authnlib.AccessTokenClaims{Permissions: []string{"*-app:get"}}}}
	for _, tc := range []struct {
		name      string
		ns        string
		verb      string
		user      identity.Requester
		allowed   bool
		checkErr  error
		want      authorizer.Decision
		wantErr   error
		wantCheck bool
	}{
		{name: "allowed user", ns: "stacks-1", verb: "get", user: settingsRequester("stacks-1"), allowed: true, want: authorizer.DecisionAllow, wantCheck: true},
		{name: "denied user", ns: "stacks-1", verb: "get", user: settingsRequester("stacks-1"), want: authorizer.DecisionDeny, wantCheck: true},
		{name: "check error", ns: "stacks-1", verb: "get", user: settingsRequester("stacks-1"), checkErr: errCheck, want: authorizer.DecisionDeny, wantErr: errCheck, wantCheck: true},
		{name: "user write needs app access only", ns: "stacks-1", verb: "create", user: settingsRequester("stacks-1"), allowed: true, want: authorizer.DecisionAllow, wantCheck: true},
		{name: "service call skips app access check", ns: "stacks-1", verb: "get", user: accessPolicy, want: authorizer.DecisionAllow},
		{name: "service token lacks verb", ns: "stacks-1", verb: "create", user: accessPolicy, allowed: true, want: authorizer.DecisionDeny},
		{name: "no namespace", verb: "get", user: settingsRequester("stacks-1"), allowed: true, want: authorizer.DecisionDeny},
		{name: "wildcard namespace", ns: "*", verb: "get", user: settingsRequester("*"), allowed: true, want: authorizer.DecisionDeny},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var calls []types.CheckRequest
			check := cloudSettingsAccessChecker(newSettingsAccessClient(func(info types.AuthInfo, req types.CheckRequest) (bool, error) {
				require.Equal(t, tc.user.GetUID(), info.GetUID())
				calls = append(calls, req)
				return tc.allowed, tc.checkErr
			}))
			// The namespace comes from RequestInfo, as it does before the apiserver sets it.
			ctx := request.WithRequestInfo(t.Context(), &request.RequestInfo{Namespace: tc.ns, Verb: tc.verb})
			decision, _, err := check(ctx, tc.user, "example-app")
			require.Equal(t, tc.want, decision)
			require.ErrorIs(t, err, tc.wantErr)
			if !tc.wantCheck {
				require.Empty(t, calls)
				return
			}
			// Every verb needs app access, which AuthZ maps from get on the settings object.
			require.Equal(t, []types.CheckRequest{{
				Verb: "get", Group: "plugins.grafana.app", Resource: "app", Namespace: tc.ns, Name: "example-app",
			}}, calls)
		})
	}
}

func TestCloudSettingsNamespaceAuthorizer(t *testing.T) {
	resource := func(verb, ns string) authorizer.AttributesRecord {
		return authorizer.AttributesRecord{Verb: verb, Namespace: ns, Resource: "app", Name: "instance", ResourceRequest: true}
	}
	for _, tc := range []struct {
		name string
		user identity.Requester
		attr authorizer.AttributesRecord
		want authorizer.Decision
	}{
		{name: "matching stack", user: settingsRequester("stacks-1"), attr: resource("get", "stacks-1"), want: authorizer.DecisionNoOpinion},
		{name: "other stack", user: settingsRequester("stacks-1"), attr: resource("get", "stacks-2"), want: authorizer.DecisionDeny},
		{name: "wildcard requester", user: settingsRequester("*"), attr: resource("get", "stacks-2"), want: authorizer.DecisionNoOpinion},
		{name: "org namespace", user: settingsRequester("default"), attr: resource("get", "default"), want: authorizer.DecisionDeny},
		{name: "cluster scoped", user: settingsRequester("stacks-1"), attr: resource("list", ""), want: authorizer.DecisionDeny},
		{name: "discovery", user: settingsRequester("stacks-1"), attr: authorizer.AttributesRecord{Verb: "get", Path: "/apis/example-app/v0alpha1"}, want: authorizer.DecisionAllow},
		{name: "non-resource write", user: settingsRequester("stacks-1"), attr: authorizer.AttributesRecord{Verb: "post", Path: "/apis/example-app/v0alpha1"}, want: authorizer.DecisionNoOpinion},
		{name: "no requester", attr: authorizer.AttributesRecord{Verb: "get", Path: "/apis/example-app/v0alpha1"}, want: authorizer.DecisionDeny},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := t.Context()
			if tc.user != nil {
				ctx = identity.WithRequester(ctx, tc.user)
			}
			decision, _, err := cloudSettingsNamespaceAuthorizer(ctx, tc.attr)
			require.NoError(t, err)
			require.Equal(t, tc.want, decision)
		})
	}
}
