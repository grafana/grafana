package router

import (
	"context"
	"errors"
	"testing"

	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
)

func TestCloudSettingsAccessChecker(t *testing.T) {
	require.Nil(t, cloudSettingsAccessChecker(nil))

	errCheck := errors.New("authz unavailable")
	accessPolicy := &identity.StaticRequester{Type: types.TypeAccessPolicy, Namespace: "*",
		AccessTokenClaims: &authnlib.Claims[authnlib.AccessTokenClaims]{Rest: authnlib.AccessTokenClaims{Permissions: []string{"*-app:get"}}}}
	for _, tc := range []struct {
		name       string
		ns         string
		verb       string
		user       identity.Requester
		allowed    bool
		checkErr   error
		want       authorizer.Decision
		wantErr    error
		wantLegacy bool
	}{
		{name: "allowed user", ns: "stacks-1", verb: "get", user: settingsRequester("stacks-1"), allowed: true, want: authorizer.DecisionAllow, wantLegacy: true},
		{name: "legacy denial", ns: "stacks-1", verb: "get", user: settingsRequester("stacks-1"), want: authorizer.DecisionDeny, wantLegacy: true},
		{name: "legacy error", ns: "stacks-1", verb: "get", user: settingsRequester("stacks-1"), checkErr: errCheck, want: authorizer.DecisionDeny, wantErr: errCheck, wantLegacy: true},
		{name: "token lacks verb", ns: "stacks-1", verb: "create", user: settingsRequester("stacks-1"), allowed: true, want: authorizer.DecisionDeny},
		{name: "service call skips legacy check", ns: "stacks-1", verb: "get", user: accessPolicy, want: authorizer.DecisionAllow},
		{name: "no namespace", verb: "get", user: settingsRequester("stacks-1"), allowed: true, want: authorizer.DecisionDeny},
		{name: "wildcard namespace", ns: "*", verb: "get", user: settingsRequester("*"), allowed: true, want: authorizer.DecisionDeny},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var calls []legacyclient.LegacyCheckRequest
			check := cloudSettingsAccessChecker(settingsLegacyCheckFunc(func(_ context.Context, req legacyclient.LegacyCheckRequest) (bool, error) {
				calls = append(calls, req)
				return tc.allowed, tc.checkErr
			}))
			// The namespace comes from RequestInfo, as it does before the apiserver sets it.
			ctx := request.WithRequestInfo(t.Context(), &request.RequestInfo{Namespace: tc.ns, Verb: tc.verb})
			decision, _, err := check(ctx, tc.user, "example-app")
			require.Equal(t, tc.want, decision)
			require.ErrorIs(t, err, tc.wantErr)
			if !tc.wantLegacy {
				require.Empty(t, calls)
				return
			}
			require.Len(t, calls, 1)
			require.Equal(t, tc.ns, calls[0].Namespace)
			require.True(t, calls[0].Evaluator.Evaluate(map[string][]string{pluginaccesscontrol.ActionAppAccess: {"plugins:id:example-app"}}))
			require.False(t, calls[0].Evaluator.Evaluate(map[string][]string{pluginaccesscontrol.ActionAppAccess: {"plugins:id:other-app"}}))
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
