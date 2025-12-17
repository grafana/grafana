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

func TestTokenAccessChecker_Check(t *testing.T) {
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
		authInfo      *identity.StaticRequester
		expectAllow   bool
	}{
		{
			name:          "allowed by checker",
			innerResponse: authlib.CheckResponse{Allowed: true},
			authInfo:      &identity.StaticRequester{Type: authlib.TypeUser},
			expectAllow:   true,
		},
		{
			name:          "denied by checker",
			innerResponse: authlib.CheckResponse{Allowed: false},
			authInfo:      &identity.StaticRequester{Type: authlib.TypeUser},
			expectAllow:   false,
		},
		{
			name:        "error from checker",
			innerErr:    errors.New("access check failed"),
			authInfo:    &identity.StaticRequester{Type: authlib.TypeUser},
			expectAllow: false,
		},
		{
			name:          "AccessPolicy identity is always allowed",
			innerResponse: authlib.CheckResponse{Allowed: false},
			authInfo:      &identity.StaticRequester{Type: authlib.TypeAccessPolicy},
			expectAllow:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := &mockInnerAccessChecker{
				response: tt.innerResponse,
				err:      tt.innerErr,
			}

			checker := NewTokenAccessChecker(mock)

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

func TestTokenAccessChecker_NoAuthInfo(t *testing.T) {
	mock := &mockInnerAccessChecker{
		response: authlib.CheckResponse{Allowed: true},
	}

	checker := NewTokenAccessChecker(mock)
	err := checker.Check(context.Background(), authlib.CheckRequest{}, "")

	require.Error(t, err)
	assert.True(t, apierrors.IsUnauthorized(err), "expected Unauthorized error")
}

func TestTokenAccessChecker_WithFallbackRole_IsNoOp(t *testing.T) {
	mock := &mockInnerAccessChecker{
		response: authlib.CheckResponse{Allowed: false},
	}

	checker := NewTokenAccessChecker(mock)
	checkerWithFallback := checker.WithFallbackRole(identity.RoleAdmin)

	// They should be the same instance
	assert.Same(t, checker, checkerWithFallback, "WithFallbackRole should return same instance")
}

func TestTokenAccessChecker_FillsNamespace(t *testing.T) {
	mock := &mockInnerAccessChecker{
		response: authlib.CheckResponse{Allowed: true},
	}

	checker := NewTokenAccessChecker(mock)

	ctx := authlib.WithAuthInfo(context.Background(), &identity.StaticRequester{
		Type:      authlib.TypeUser,
		Namespace: "org-123",
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

// mockInnerAccessChecker implements authlib.AccessChecker for testing.
type mockInnerAccessChecker struct {
	response authlib.CheckResponse
	err      error
}

func (m *mockInnerAccessChecker) Check(_ context.Context, _ authlib.AuthInfo, _ authlib.CheckRequest, _ string) (authlib.CheckResponse, error) {
	return m.response, m.err
}

func (m *mockInnerAccessChecker) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, nil, nil
}

