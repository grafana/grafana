package server

import (
	"context"
	"testing"

	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func TestAnonymousAuthorizationIsLimitedToPublicReads(t *testing.T) {
	authorize := withRequesterAuthorization(authorizer.AuthorizerFunc(func(context.Context, authorizer.Attributes) (authorizer.Decision, string, error) {
		return authorizer.DecisionAllow, "", nil
	}))

	tests := []struct {
		verb string
		path string
		want authorizer.Decision
	}{
		{verb: "get", path: "/readyz", want: authorizer.DecisionAllow},
		{verb: "get", path: "/metrics", want: authorizer.DecisionAllow},
		{verb: "head", path: "/livez", want: authorizer.DecisionAllow},
		{verb: "post", path: "/readyz", want: authorizer.DecisionDeny},
		{verb: "get", path: "/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-11/events", want: authorizer.DecisionDeny},
	}
	for _, test := range tests {
		decision, _, err := authorize.Authorize(t.Context(), authorizer.AttributesRecord{Verb: test.verb, Path: test.path})
		if err != nil {
			t.Fatal(err)
		}
		if decision != test.want {
			t.Errorf("%s %s: decision %v, want %v", test.verb, test.path, decision, test.want)
		}
	}
}
