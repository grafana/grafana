package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	authn "github.com/grafana/authlib/authn"
	authlib "github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	requestcontext "k8s.io/apiserver/pkg/endpoints/request"
)

func runTestAuthInfo() authlib.AuthInfo {
	access := authn.Claims[authn.AccessTokenClaims]{Rest: authn.AccessTokenClaims{Namespace: "stacks-11"}}
	return authn.NewIDTokenAuthInfo(access, &authn.Claims[authn.IDTokenClaims]{Rest: authn.IDTokenClaims{
		Namespace: "stacks-11", Type: authlib.TypeUser, Identifier: "user-1",
	}})
}

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

func TestAuthInfoContextBridge(t *testing.T) {
	info := runTestAuthInfo()
	var authorizedInfo authlib.AuthInfo
	authorize := withRequesterAuthorization(authorizer.AuthorizerFunc(func(ctx context.Context, _ authorizer.Attributes) (authorizer.Decision, string, error) {
		authorizedInfo, _ = authlib.AuthInfoFrom(ctx)
		return authorizer.DecisionAllow, "", nil
	}))

	decision, _, err := authorize.Authorize(context.Background(), authorizer.AttributesRecord{
		User: info, Verb: "get", Path: "/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-11/events",
	})
	if err != nil {
		t.Fatal(err)
	}
	if decision != authorizer.DecisionAllow {
		t.Fatalf("decision = %v, want allow", decision)
	}
	if authorizedInfo != info {
		t.Fatal("authorizer did not receive the authenticated AuthInfo")
	}

	var handlerInfo authlib.AuthInfo
	handler := requesterHandler{next: http.HandlerFunc(func(_ http.ResponseWriter, request *http.Request) {
		handlerInfo, _ = authlib.AuthInfoFrom(request.Context())
	})}
	request := httptest.NewRequest(http.MethodGet, "/apis/error-tracking.grafana.app/v0alpha1/namespaces/stacks-11/events", nil)
	request = request.WithContext(requestcontext.WithUser(context.Background(), info))
	handler.ServeHTTP(httptest.NewRecorder(), request)
	if handlerInfo != info {
		t.Fatal("request handler did not receive the authenticated AuthInfo")
	}
}
