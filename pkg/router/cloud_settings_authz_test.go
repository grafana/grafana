package router

import (
	"errors"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

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
