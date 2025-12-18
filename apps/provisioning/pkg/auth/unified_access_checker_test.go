package auth

import (
	"context"
	"errors"
	"testing"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockInnerAccessChecker is a mock implementation of authlib.AccessChecker for testing.
type mockInnerAccessChecker struct {
	response authlib.CheckResponse
	err      error
}

func (m *mockInnerAccessChecker) Check(_ context.Context, _ authlib.AuthInfo, _ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
	return m.response, m.err
}

func (m *mockInnerAccessChecker) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, authlib.NoopZookie{}, nil
}

func TestUnifiedAccessChecker_WithTokenIdentity(t *testing.T) {
	req := authlib.CheckRequest{
		Verb:      "get",
		Group:     "provisioning.grafana.app",
		Resource:  "repositories",
		Name:      "test-repo",
		Namespace: "default",
	}

	tests := []struct {
		name                                string
		innerResponse                       authlib.CheckResponse
		innerErr                            error
		useExclusivelyAccessCheckerForAuthz bool
		authInfo                            *identity.StaticRequester
		expectAllow                         bool
	}{
		{
			name:                                "allowed by checker with token in MT mode",
			innerResponse:                       authlib.CheckResponse{Allowed: true},
			useExclusivelyAccessCheckerForAuthz: true,
			authInfo:                            &identity.StaticRequester{Type: authlib.TypeUser},
			expectAllow:                         true,
		},
		{
			name:                                "denied by checker with token in MT mode",
			innerResponse:                       authlib.CheckResponse{Allowed: false},
			useExclusivelyAccessCheckerForAuthz: true,
			authInfo:                            &identity.StaticRequester{Type: authlib.TypeUser},
			expectAllow:                         false,
		},
		{
			name:                                "allowed by checker with AccessPolicy in ST mode",
			innerResponse:                       authlib.CheckResponse{Allowed: true},
			useExclusivelyAccessCheckerForAuthz: false,
			authInfo:                            &identity.StaticRequester{Type: authlib.TypeAccessPolicy},
			expectAllow:                         true,
		},
		{
			name:                                "error from checker",
			innerErr:                            errors.New("access check failed"),
			useExclusivelyAccessCheckerForAuthz: true,
			authInfo:                            &identity.StaticRequester{Type: authlib.TypeUser},
			expectAllow:                         false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := &mockInnerAccessChecker{
				response: tt.innerResponse,
				err:      tt.innerErr,
			}

			checker := NewAccessChecker(mock, tt.useExclusivelyAccessCheckerForAuthz)

			// Add auth info to context
			testCtx := authlib.WithAuthInfo(context.Background(), tt.authInfo)

			err := checker.Check(testCtx, req, "")

			if tt.expectAllow {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
				assert.True(t, apierrors.IsForbidden(err), "expected Forbidden error, got: %v", err)
			}
		})
	}
}

func TestUnifiedAccessChecker_WithSessionIdentity(t *testing.T) {
	req := authlib.CheckRequest{
		Verb:      "get",
		Group:     "provisioning.grafana.app",
		Resource:  "repositories",
		Name:      "test-repo",
		Namespace: "default",
	}

	tests := []struct {
		name          string
		innerResponse authlib.CheckResponse
		innerErr      error
		fallbackRole  identity.RoleType
		requesterRole identity.RoleType
		expectAllow   bool
	}{
		{
			name:          "allowed by checker without fallback",
			innerResponse: authlib.CheckResponse{Allowed: true},
			fallbackRole:  "",
			requesterRole: identity.RoleViewer,
			expectAllow:   true,
		},
		{
			name:          "denied by checker without fallback",
			innerResponse: authlib.CheckResponse{Allowed: false},
			fallbackRole:  "",
			requesterRole: identity.RoleViewer,
			expectAllow:   false,
		},
		{
			name:          "denied by checker but allowed by admin fallback",
			innerResponse: authlib.CheckResponse{Allowed: false},
			fallbackRole:  identity.RoleAdmin,
			requesterRole: identity.RoleAdmin,
			expectAllow:   true,
		},
		{
			name:          "denied by checker and fallback role not met",
			innerResponse: authlib.CheckResponse{Allowed: false},
			fallbackRole:  identity.RoleAdmin,
			requesterRole: identity.RoleViewer,
			expectAllow:   false,
		},
		{
			name:          "error from checker but allowed by fallback",
			innerErr:      errors.New("access check failed"),
			fallbackRole:  identity.RoleAdmin,
			requesterRole: identity.RoleAdmin,
			expectAllow:   true,
		},
		{
			name:          "error from checker and fallback role not met",
			innerErr:      errors.New("access check failed"),
			fallbackRole:  identity.RoleAdmin,
			requesterRole: identity.RoleViewer,
			expectAllow:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := &mockInnerAccessChecker{
				response: tt.innerResponse,
				err:      tt.innerErr,
			}

			// ST mode (useExclusivelyAccessCheckerForAuthz=false) with non-AccessPolicy identity
			// will fall through to session-based check
			checker := NewAccessChecker(mock, false)
			if tt.fallbackRole != "" {
				checker = checker.WithFallbackRole(tt.fallbackRole)
			}

			// Create context with session identity (no token auth info)
			requester := &identity.StaticRequester{
				Type:    authlib.TypeUser,
				OrgRole: tt.requesterRole,
			}
			testCtx := identity.WithRequester(context.Background(), requester)

			err := checker.Check(testCtx, req, "")

			if tt.expectAllow {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
				assert.True(t, apierrors.IsForbidden(err), "expected Forbidden error, got: %v", err)
			}
		})
	}
}

func TestUnifiedAccessChecker_FallsBackToSessionWhenNoToken(t *testing.T) {
	req := authlib.CheckRequest{
		Verb:      "get",
		Group:     "provisioning.grafana.app",
		Resource:  "repositories",
		Name:      "test-repo",
		Namespace: "default",
	}

	mock := &mockInnerAccessChecker{
		response: authlib.CheckResponse{Allowed: true},
	}

	// MT mode but no token in context - should fall back to session
	checker := NewAccessChecker(mock, true)

	// Create context with only session identity (no token auth info)
	requester := &identity.StaticRequester{
		Type:    authlib.TypeUser,
		OrgRole: identity.RoleAdmin,
	}
	testCtx := identity.WithRequester(context.Background(), requester)

	err := checker.Check(testCtx, req, "")
	require.NoError(t, err, "should succeed using session identity when no token is present")
}

func TestUnifiedAccessChecker_NoIdentityReturnsUnauthorized(t *testing.T) {
	req := authlib.CheckRequest{
		Verb:      "get",
		Group:     "provisioning.grafana.app",
		Resource:  "repositories",
		Name:      "test-repo",
		Namespace: "default",
	}

	mock := &mockInnerAccessChecker{
		response: authlib.CheckResponse{Allowed: true},
	}

	checker := NewAccessChecker(mock, true)

	// Empty context with no identity
	err := checker.Check(context.Background(), req, "")
	require.Error(t, err)
	assert.True(t, apierrors.IsUnauthorized(err), "expected Unauthorized error, got: %v", err)
}

func TestUnifiedAccessChecker_WithFallbackRole(t *testing.T) {
	mock := &mockInnerAccessChecker{}
	checker := NewAccessChecker(mock, false)

	// WithFallbackRole should return a new checker with the role configured
	checkerWithAdmin := checker.WithFallbackRole(identity.RoleAdmin)
	checkerWithEditor := checker.WithFallbackRole(identity.RoleEditor)

	// They should be different instances
	assert.NotEqual(t, checker, checkerWithAdmin)
	assert.NotEqual(t, checkerWithAdmin, checkerWithEditor)
}

func TestUnifiedAccessChecker_FillsNamespaceFromIdentity(t *testing.T) {
	mock := &mockInnerAccessChecker{
		response: authlib.CheckResponse{Allowed: true},
	}

	checker := NewAccessChecker(mock, true)

	// Request without namespace
	req := authlib.CheckRequest{
		Verb:     "get",
		Group:    "provisioning.grafana.app",
		Resource: "repositories",
		Name:     "test-repo",
		// Namespace not set
	}

	// Create context with identity that has a namespace
	requester := &identity.StaticRequester{
		Type:      authlib.TypeUser,
		OrgRole:   identity.RoleAdmin,
		Namespace: "stacks-123",
	}
	testCtx := authlib.WithAuthInfo(context.Background(), requester)

	err := checker.Check(testCtx, req, "")
	require.NoError(t, err)
}
