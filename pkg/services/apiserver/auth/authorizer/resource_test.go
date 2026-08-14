package authorizer

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

// fakeAccessChecker is a fake implementation of claims.AccessChecker for testing
type fakeAccessChecker struct {
	checkFunc func(ctx context.Context, ident types.AuthInfo, req types.CheckRequest, extra string) (types.CheckResponse, error)
}

func (m *fakeAccessChecker) Check(ctx context.Context, ident types.AuthInfo, req types.CheckRequest, extra string) (types.CheckResponse, error) {
	return m.checkFunc(ctx, ident, req, extra)
}

// mockAttributes is a mock implementation of authorizer.Attributes for testing
type mockAttributes struct {
	authorizer.Attributes
	isResourceRequest bool
	verb              string
	apiGroup          string
	resource          string
	namespace         string
	name              string
	subresource       string
	path              string
}

func (a mockAttributes) IsResourceRequest() bool { return a.isResourceRequest }
func (a mockAttributes) GetVerb() string         { return a.verb }
func (a mockAttributes) GetAPIGroup() string     { return a.apiGroup }
func (a mockAttributes) GetResource() string     { return a.resource }
func (a mockAttributes) GetNamespace() string    { return a.namespace }
func (a mockAttributes) GetName() string         { return a.name }
func (a mockAttributes) GetSubresource() string  { return a.subresource }
func (a mockAttributes) GetPath() string         { return a.path }

// newTestAuthInfo returns a minimal AuthInfo for use in authorization tests.
func newTestAuthInfo() types.AuthInfo {
	return authn.NewIDTokenAuthInfo(
		authn.Claims[authn.AccessTokenClaims]{},
		&authn.Claims[authn.IDTokenClaims]{},
	)
}

func TestNewResourceAuthorizerWithSubresourceHandlers_EmptySubresource_DelegatesToResourceAuthorizer(t *testing.T) {
	mockChecker := &fakeAccessChecker{
		checkFunc: func(ctx context.Context, ident types.AuthInfo, req types.CheckRequest, extra string) (types.CheckResponse, error) {
			return types.CheckResponse{Allowed: true}, nil
		},
	}

	auth := NewResourceAuthorizerWithSubresourceHandlers(mockChecker, map[string]SubresourceCheck{
		"test": func(ctx context.Context, ident types.AuthInfo, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			return authorizer.DecisionDeny, "should not be called", nil
		},
	})

	// Empty subresource should delegate to ResourceAuthorizer
	attrs := mockAttributes{
		isResourceRequest: true,
		verb:              "get",
		apiGroup:          "test.group",
		resource:          "testresource",
		namespace:         "testns",
		name:              "testname",
		subresource:       "", // empty subresource
	}

	ctx := types.WithAuthInfo(context.Background(), newTestAuthInfo())
	decision, reason, err := auth.Authorize(ctx, attrs)
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionAllow, decision)
	require.Empty(t, reason)
}

func TestNewResourceAuthorizerWithSubresourceHandlers_KnownSubresource_RunsSubresourceCheck(t *testing.T) {
	checkCalled := false
	mockChecker := &fakeAccessChecker{
		checkFunc: func(ctx context.Context, ident types.AuthInfo, req types.CheckRequest, extra string) (types.CheckResponse, error) {
			return types.CheckResponse{Allowed: true}, nil
		},
	}

	subresourceCheck := func(ctx context.Context, ident types.AuthInfo, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		checkCalled = true
		// Verify the attributes are passed correctly
		require.Equal(t, "testresource", attr.GetResource())
		require.Equal(t, "testsub", attr.GetSubresource())
		return authorizer.DecisionAllow, "", nil
	}

	auth := NewResourceAuthorizerWithSubresourceHandlers(mockChecker, map[string]SubresourceCheck{
		"testsub": subresourceCheck,
	})

	// Add auth info to context so it's not denied due to missing identity
	ctx := types.WithAuthInfo(context.Background(), newTestAuthInfo())

	attrs := mockAttributes{
		isResourceRequest: true,
		verb:              "get",
		apiGroup:          "test.group",
		resource:          "testresource",
		namespace:         "testns",
		name:              "testname",
		subresource:       "testsub",
	}

	decision, reason, err := auth.Authorize(ctx, attrs)
	require.NoError(t, err)
	require.True(t, checkCalled, "subresource check should have been called")
	require.Equal(t, authorizer.DecisionAllow, decision)
	require.Empty(t, reason)
}

func TestNewResourceAuthorizerWithSubresourceHandlers_KnownSubresource_Denied(t *testing.T) {
	mockChecker := &fakeAccessChecker{
		checkFunc: func(ctx context.Context, ident types.AuthInfo, req types.CheckRequest, extra string) (types.CheckResponse, error) {
			return types.CheckResponse{Allowed: true}, nil
		},
	}

	subresourceCheck := func(ctx context.Context, ident types.AuthInfo, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		return authorizer.DecisionDeny, "custom denial reason", nil
	}

	auth := NewResourceAuthorizerWithSubresourceHandlers(mockChecker, map[string]SubresourceCheck{
		"testsub": subresourceCheck,
	})

	ctx := types.WithAuthInfo(context.Background(), newTestAuthInfo())

	attrs := mockAttributes{
		isResourceRequest: true,
		verb:              "get",
		apiGroup:          "test.group",
		resource:          "testresource",
		namespace:         "testns",
		name:              "testname",
		subresource:       "testsub",
	}

	decision, reason, err := auth.Authorize(ctx, attrs)
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionDeny, decision)
	require.Equal(t, "custom denial reason", reason)
}

func TestNewResourceAuthorizerWithSubresourceHandlers_UnknownSubresource_ReturnsDeny(t *testing.T) {
	mockChecker := &fakeAccessChecker{
		checkFunc: func(ctx context.Context, ident types.AuthInfo, req types.CheckRequest, extra string) (types.CheckResponse, error) {
			return types.CheckResponse{Allowed: true}, nil
		},
	}

	auth := NewResourceAuthorizerWithSubresourceHandlers(mockChecker, map[string]SubresourceCheck{
		"knownsub": func(ctx context.Context, ident types.AuthInfo, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			return authorizer.DecisionAllow, "", nil
		},
	})

	ctx := context.Background()

	attrs := mockAttributes{
		isResourceRequest: true,
		verb:              "get",
		apiGroup:          "test.group",
		resource:          "testresource",
		namespace:         "testns",
		name:              "testname",
		subresource:       "unknownsub",
	}

	decision, reason, err := auth.Authorize(ctx, attrs)
	require.Error(t, err)
	require.Contains(t, err.Error(), "no authorizer for subresource")
	require.Equal(t, authorizer.DecisionDeny, decision)
	require.Empty(t, reason)
}

func TestNewResourceAuthorizerWithSubresourceHandlers_NonResourceRequest_ReturnsNoOpinion(t *testing.T) {
	mockChecker := &fakeAccessChecker{
		checkFunc: func(ctx context.Context, ident types.AuthInfo, req types.CheckRequest, extra string) (types.CheckResponse, error) {
			return types.CheckResponse{Allowed: true}, nil
		},
	}

	auth := NewResourceAuthorizerWithSubresourceHandlers(mockChecker, map[string]SubresourceCheck{
		"testsub": func(ctx context.Context, ident types.AuthInfo, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			return authorizer.DecisionAllow, "", nil
		},
	})

	ctx := context.Background()

	attrs := mockAttributes{
		isResourceRequest: false, // not a resource request
		verb:              "get",
		apiGroup:          "test.group",
		resource:          "testresource",
		namespace:         "testns",
		name:              "testname",
		subresource:       "testsub",
	}

	decision, reason, err := auth.Authorize(ctx, attrs)
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionNoOpinion, decision)
	require.Empty(t, reason)
}

func TestNewResourceAuthorizerWithSubresourceHandlers_NoIdentity_ReturnsDeny(t *testing.T) {
	mockChecker := &fakeAccessChecker{
		checkFunc: func(ctx context.Context, ident types.AuthInfo, req types.CheckRequest, extra string) (types.CheckResponse, error) {
			return types.CheckResponse{Allowed: true}, nil
		},
	}

	auth := NewResourceAuthorizerWithSubresourceHandlers(mockChecker, map[string]SubresourceCheck{
		"testsub": func(ctx context.Context, ident types.AuthInfo, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			return authorizer.DecisionAllow, "", nil
		},
	})

	// No auth info in context
	ctx := context.Background()

	attrs := mockAttributes{
		isResourceRequest: true,
		verb:              "get",
		apiGroup:          "test.group",
		resource:          "testresource",
		namespace:         "testns",
		name:              "testname",
		subresource:       "testsub",
	}

	decision, reason, err := auth.Authorize(ctx, attrs)
	require.Error(t, err)
	require.Contains(t, err.Error(), "no identity found")
	require.Equal(t, authorizer.DecisionDeny, decision)
	require.Empty(t, reason)
}

func TestNewResourceAuthorizerWithSubresourceHandlers_DelegateCheckError(t *testing.T) {
	mockChecker := &fakeAccessChecker{
		checkFunc: func(ctx context.Context, ident types.AuthInfo, req types.CheckRequest, extra string) (types.CheckResponse, error) {
			return types.CheckResponse{}, errors.New("check failed")
		},
	}

	auth := NewResourceAuthorizerWithSubresourceHandlers(mockChecker, map[string]SubresourceCheck{})

	ctx := types.WithAuthInfo(context.Background(), newTestAuthInfo())

	attrs := mockAttributes{
		isResourceRequest: true,
		verb:              "get",
		apiGroup:          "test.group",
		resource:          "testresource",
		namespace:         "testns",
		name:              "testname",
		subresource:       "", // empty subresource
	}

	decision, reason, err := auth.Authorize(ctx, attrs)
	require.Error(t, err)
	require.Contains(t, err.Error(), "check failed")
	require.Equal(t, authorizer.DecisionDeny, decision)
	require.Empty(t, reason)
}

func TestNewResourceAuthorizerWithSubresourceHandlers_DelegateCheckDenied(t *testing.T) {
	mockChecker := &fakeAccessChecker{
		checkFunc: func(ctx context.Context, ident types.AuthInfo, req types.CheckRequest, extra string) (types.CheckResponse, error) {
			return types.CheckResponse{Allowed: false}, nil
		},
	}

	auth := NewResourceAuthorizerWithSubresourceHandlers(mockChecker, map[string]SubresourceCheck{})

	ctx := types.WithAuthInfo(context.Background(), newTestAuthInfo())

	attrs := mockAttributes{
		isResourceRequest: true,
		verb:              "get",
		apiGroup:          "test.group",
		resource:          "testresource",
		namespace:         "testns",
		name:              "testname",
		subresource:       "", // empty subresource
	}

	decision, reason, err := auth.Authorize(ctx, attrs)
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionDeny, decision)
	require.Equal(t, "unauthorized request", reason)
}
