package router

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

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
