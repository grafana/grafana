package auth

import (
	"context"
	"errors"
	"testing"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockAccessChecker implements authlib.AccessChecker for testing.
type mockAccessChecker struct {
	response authlib.CheckResponse
	err      error
}

func (m *mockAccessChecker) Check(_ context.Context, _ authlib.AuthInfo, _ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
	return m.response, m.err
}

func (m *mockAccessChecker) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, nil, nil
}

// mockRequester implements identity.Requester for testing.
type mockRequester struct {
	identity.Requester
	orgRole      identity.RoleType
	identityType authlib.IdentityType
	namespace    string
}

func (m *mockRequester) GetOrgRole() identity.RoleType {
	return m.orgRole
}

func (m *mockRequester) GetIdentityType() authlib.IdentityType {
	return m.identityType
}

func (m *mockRequester) GetNamespace() string {
	return m.namespace
}

func TestAccessChecker_Check_SingleTenant(t *testing.T) {
	ctx := context.Background()
	req := authlib.CheckRequest{
		Verb:      "get",
		Group:     "provisioning.grafana.app",
		Resource:  "repositories",
		Name:      "test-repo",
		Namespace: "default",
	}

	tests := []struct {
		name          string
		fallbackRole  identity.RoleType
		innerResponse authlib.CheckResponse
		innerErr      error
		requester     *mockRequester
		expectAllow   bool
	}{
		{
			name:          "allowed by checker",
			fallbackRole:  identity.RoleAdmin,
			innerResponse: authlib.CheckResponse{Allowed: true},
			requester:     &mockRequester{orgRole: identity.RoleViewer, identityType: authlib.TypeUser},
			expectAllow:   true,
		},
		{
			name:          "denied by checker, fallback to admin role succeeds",
			fallbackRole:  identity.RoleAdmin,
			innerResponse: authlib.CheckResponse{Allowed: false},
			requester:     &mockRequester{orgRole: identity.RoleAdmin, identityType: authlib.TypeUser},
			expectAllow:   true,
		},
		{
			name:          "denied by checker, fallback to admin role fails for viewer",
			fallbackRole:  identity.RoleAdmin,
			innerResponse: authlib.CheckResponse{Allowed: false},
			requester:     &mockRequester{orgRole: identity.RoleViewer, identityType: authlib.TypeUser},
			expectAllow:   false,
		},
		{
			name:         "error from checker, fallback to admin role succeeds",
			fallbackRole: identity.RoleAdmin,
			innerErr:     errors.New("access check failed"),
			requester:    &mockRequester{orgRole: identity.RoleAdmin, identityType: authlib.TypeUser},
			expectAllow:  true,
		},
		{
			name:         "error from checker, fallback fails for viewer",
			fallbackRole: identity.RoleAdmin,
			innerErr:     errors.New("access check failed"),
			requester:    &mockRequester{orgRole: identity.RoleViewer, identityType: authlib.TypeUser},
			expectAllow:  false,
		},
		{
			name:          "denied, editor fallback succeeds for editor",
			fallbackRole:  identity.RoleEditor,
			innerResponse: authlib.CheckResponse{Allowed: false},
			requester:     &mockRequester{orgRole: identity.RoleEditor, identityType: authlib.TypeUser},
			expectAllow:   true,
		},
		{
			name:          "denied, editor fallback fails for viewer",
			fallbackRole:  identity.RoleEditor,
			innerResponse: authlib.CheckResponse{Allowed: false},
			requester:     &mockRequester{orgRole: identity.RoleViewer, identityType: authlib.TypeUser},
			expectAllow:   false,
		},
		{
			name:          "no fallback configured, denied stays denied",
			fallbackRole:  "", // no fallback
			innerResponse: authlib.CheckResponse{Allowed: false},
			requester:     &mockRequester{orgRole: identity.RoleAdmin, identityType: authlib.TypeUser},
			expectAllow:   false,
		},
		{
			name:          "AccessPolicy identity is always allowed",
			innerResponse: authlib.CheckResponse{Allowed: false},
			requester:     &mockRequester{orgRole: identity.RoleViewer, identityType: authlib.TypeAccessPolicy},
			expectAllow:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := &mockAccessChecker{
				response: tt.innerResponse,
				err:      tt.innerErr,
			}

			checker := NewAccessChecker(mock, false) // ST mode
			if tt.fallbackRole != "" {
				checker = checker.WithFallback(tt.fallbackRole)
			}

			// Add requester to context (ST mode uses GetRequester)
			testCtx := identity.WithRequester(ctx, tt.requester)

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

func TestAccessChecker_Check_MultiTenant(t *testing.T) {
	req := authlib.CheckRequest{
		Verb:      "get",
		Group:     "provisioning.grafana.app",
		Resource:  "repositories",
		Name:      "test-repo",
		Namespace: "default",
	}

	tests := []struct {
		name          string
		fallbackRole  identity.RoleType
		innerResponse authlib.CheckResponse
		innerErr      error
		authInfo      authlib.AuthInfo
		expectAllow   bool
	}{
		{
			name:          "allowed by checker",
			fallbackRole:  identity.RoleAdmin,
			innerResponse: authlib.CheckResponse{Allowed: true},
			authInfo:      &mockRequester{orgRole: identity.RoleViewer, identityType: authlib.TypeUser},
			expectAllow:   true,
		},
		{
			name:          "denied by checker, no fallback even with admin role",
			fallbackRole:  identity.RoleAdmin,
			innerResponse: authlib.CheckResponse{Allowed: false},
			authInfo:      &mockRequester{orgRole: identity.RoleAdmin, identityType: authlib.TypeUser},
			expectAllow:   false, // MT mode: no fallback
		},
		{
			name:         "error from checker, no fallback even with admin role",
			fallbackRole: identity.RoleAdmin,
			innerErr:     errors.New("access check failed"),
			authInfo:     &mockRequester{orgRole: identity.RoleAdmin, identityType: authlib.TypeUser},
			expectAllow:  false, // MT mode: no fallback
		},
		{
			name:          "AccessPolicy identity is always allowed",
			innerResponse: authlib.CheckResponse{Allowed: false},
			authInfo:      &mockRequester{orgRole: identity.RoleViewer, identityType: authlib.TypeAccessPolicy},
			expectAllow:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := &mockAccessChecker{
				response: tt.innerResponse,
				err:      tt.innerErr,
			}

			checker := NewAccessChecker(mock, true) // MT mode
			if tt.fallbackRole != "" {
				checker = checker.WithFallback(tt.fallbackRole)
			}

			// Add auth info to context (MT mode uses AuthInfoFrom)
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

func TestAccessChecker_Check_NoIdentity(t *testing.T) {
	mock := &mockAccessChecker{
		response: authlib.CheckResponse{Allowed: true},
	}

	t.Run("ST mode without requester", func(t *testing.T) {
		checker := NewAccessChecker(mock, false) // ST mode
		err := checker.Check(context.Background(), authlib.CheckRequest{}, "")
		require.Error(t, err)
		assert.True(t, apierrors.IsUnauthorized(err), "expected Unauthorized error")
	})

	t.Run("MT mode without auth info", func(t *testing.T) {
		checker := NewAccessChecker(mock, true) // MT mode
		err := checker.Check(context.Background(), authlib.CheckRequest{}, "")
		require.Error(t, err)
		assert.True(t, apierrors.IsUnauthorized(err), "expected Unauthorized error")
	})
}

func TestAccessChecker_WithFallback_ImmutableOriginal(t *testing.T) {
	mock := &mockAccessChecker{
		response: authlib.CheckResponse{Allowed: false},
	}

	original := NewAccessChecker(mock, false) // ST mode
	withAdmin := original.WithFallback(identity.RoleAdmin)
	withEditor := original.WithFallback(identity.RoleEditor)

	ctx := identity.WithRequester(context.Background(), &mockRequester{
		orgRole:      identity.RoleEditor,
		identityType: authlib.TypeUser,
	})

	req := authlib.CheckRequest{}

	// Original should deny (no fallback)
	err := original.Check(ctx, req, "")
	require.Error(t, err, "original should deny without fallback")

	// WithAdmin should deny for editor
	err = withAdmin.Check(ctx, req, "")
	require.Error(t, err, "admin fallback should deny for editor")

	// WithEditor should allow for editor
	err = withEditor.Check(ctx, req, "")
	require.NoError(t, err, "editor fallback should allow for editor")
}

func TestAccessChecker_WithFallback_ChainedCalls(t *testing.T) {
	mock := &mockAccessChecker{
		response: authlib.CheckResponse{Allowed: false},
	}

	// Ensure chained WithFallback calls work correctly
	checker := NewAccessChecker(mock, false). // ST mode
							WithFallback(identity.RoleAdmin).
							WithFallback(identity.RoleEditor) // This should override admin

	ctx := identity.WithRequester(context.Background(), &mockRequester{
		orgRole:      identity.RoleEditor,
		identityType: authlib.TypeUser,
	})

	err := checker.Check(ctx, authlib.CheckRequest{}, "")
	require.NoError(t, err, "last fallback (editor) should be used")
}

func TestAccessChecker_RealSignedInUser(t *testing.T) {
	mock := &mockAccessChecker{
		response: authlib.CheckResponse{Allowed: false},
	}

	checker := NewAccessChecker(mock, false).WithFallback(identity.RoleAdmin) // ST mode

	// Use a real SignedInUser
	signedInUser := &user.SignedInUser{
		UserID:  1,
		OrgID:   1,
		OrgRole: identity.RoleAdmin,
	}

	ctx := identity.WithRequester(context.Background(), signedInUser)

	err := checker.Check(ctx, authlib.CheckRequest{}, "")
	require.NoError(t, err, "admin user should be allowed via fallback")
}

func TestAccessChecker_Check_FillsNamespace(t *testing.T) {
	mock := &mockAccessChecker{
		response: authlib.CheckResponse{Allowed: true},
	}

	checker := NewAccessChecker(mock, false) // ST mode

	ctx := identity.WithRequester(context.Background(), &mockRequester{
		orgRole:      identity.RoleAdmin,
		identityType: authlib.TypeUser,
		namespace:    "org-123",
	})

	// Request without namespace
	req := authlib.CheckRequest{
		Verb:     "get",
		Group:    "provisioning.grafana.app",
		Resource: "repositories",
		Name:     "test-repo",
		// Namespace intentionally empty
	}

	err := checker.Check(ctx, req, "")
	require.NoError(t, err)
	// The namespace should have been filled from the identity
}
