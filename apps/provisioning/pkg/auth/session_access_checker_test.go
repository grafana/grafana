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

func TestSessionAccessChecker_Check(t *testing.T) {
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
			mock := &mockInnerAccessChecker{
				response: tt.innerResponse,
				err:      tt.innerErr,
			}

			checker := NewSessionAccessChecker(mock)
			if tt.fallbackRole != "" {
				checker = checker.WithFallbackRole(tt.fallbackRole)
			}

			// Add requester to context
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

func TestSessionAccessChecker_NoRequester(t *testing.T) {
	mock := &mockInnerAccessChecker{
		response: authlib.CheckResponse{Allowed: true},
	}

	checker := NewSessionAccessChecker(mock)
	err := checker.Check(context.Background(), authlib.CheckRequest{}, "")

	require.Error(t, err)
	assert.True(t, apierrors.IsUnauthorized(err), "expected Unauthorized error")
}

func TestSessionAccessChecker_WithFallbackRole_ImmutableOriginal(t *testing.T) {
	mock := &mockInnerAccessChecker{
		response: authlib.CheckResponse{Allowed: false},
	}

	original := NewSessionAccessChecker(mock)
	withAdmin := original.WithFallbackRole(identity.RoleAdmin)
	withEditor := original.WithFallbackRole(identity.RoleEditor)

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

func TestSessionAccessChecker_WithFallbackRole_ChainedCalls(t *testing.T) {
	mock := &mockInnerAccessChecker{
		response: authlib.CheckResponse{Allowed: false},
	}

	// Ensure chained WithFallbackRole calls work correctly
	checker := NewSessionAccessChecker(mock).
		WithFallbackRole(identity.RoleAdmin).
		WithFallbackRole(identity.RoleEditor) // This should override admin

	ctx := identity.WithRequester(context.Background(), &mockRequester{
		orgRole:      identity.RoleEditor,
		identityType: authlib.TypeUser,
	})

	err := checker.Check(ctx, authlib.CheckRequest{}, "")
	require.NoError(t, err, "last fallback (editor) should be used")
}

func TestSessionAccessChecker_RealSignedInUser(t *testing.T) {
	mock := &mockInnerAccessChecker{
		response: authlib.CheckResponse{Allowed: false},
	}

	checker := NewSessionAccessChecker(mock).WithFallbackRole(identity.RoleAdmin)

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

func TestSessionAccessChecker_FillsNamespace(t *testing.T) {
	mock := &mockInnerAccessChecker{
		response: authlib.CheckResponse{Allowed: true},
	}

	checker := NewSessionAccessChecker(mock)

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
}

