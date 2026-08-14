package resources

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestCheckResourceOwnership(t *testing.T) {
	tests := []struct {
		name              string
		existingResource  *unstructured.Unstructured
		requestingManager utils.ManagerProperties
		expectError       bool
		expectedMessage   string
	}{
		{
			name:             "no existing resource - allow operation",
			existingResource: nil, // Explicitly nil to represent non-existing resource
			requestingManager: utils.ManagerProperties{
				Kind:     utils.ManagerKindRepo,
				Identity: "repo-1",
			},
			expectError: false,
		},
		{
			name: "existing resource with no manager - deny operation",
			existingResource: &unstructured.Unstructured{
				Object: map[string]interface{}{
					"metadata": map[string]interface{}{
						"name": "test-resource",
					},
				},
			},
			requestingManager: utils.ManagerProperties{
				Kind:     utils.ManagerKindRepo,
				Identity: "repo-1",
			},
			expectError:     true,
			expectedMessage: "resource 'test-resource' already exists and is not managed",
		},
		{
			name: "same manager - allow operation",
			existingResource: &unstructured.Unstructured{
				Object: map[string]interface{}{
					"metadata": map[string]interface{}{
						"name": "test-resource",
						"annotations": map[string]interface{}{
							utils.AnnoKeyManagerKind:     "repo",
							utils.AnnoKeyManagerIdentity: "repo-1",
						},
					},
				},
			},
			requestingManager: utils.ManagerProperties{
				Kind:     utils.ManagerKindRepo,
				Identity: "repo-1",
			},
			expectError: false,
		},
		{
			name: "different manager but allows edits - allow operation",
			existingResource: &unstructured.Unstructured{
				Object: map[string]interface{}{
					"metadata": map[string]interface{}{
						"name": "test-resource",
						"annotations": map[string]interface{}{
							utils.AnnoKeyManagerKind:        "repo",
							utils.AnnoKeyManagerIdentity:    "repo-1",
							utils.AnnoKeyManagerAllowsEdits: "true",
						},
					},
				},
			},
			requestingManager: utils.ManagerProperties{
				Kind:     utils.ManagerKindRepo,
				Identity: "repo-2",
			},
			expectError: false,
		},
		{
			name: "different manager and doesn't allow edits - deny operation",
			existingResource: &unstructured.Unstructured{
				Object: map[string]interface{}{
					"metadata": map[string]interface{}{
						"name": "test-resource",
						"annotations": map[string]interface{}{
							utils.AnnoKeyManagerKind:     "repo",
							utils.AnnoKeyManagerIdentity: "repo-1",
						},
					},
				},
			},
			requestingManager: utils.ManagerProperties{
				Kind:     utils.ManagerKindRepo,
				Identity: "repo-2",
			},
			expectError:     true,
			expectedMessage: "resource 'test-resource' is managed by repo 'repo-1' and cannot be modified by repo 'repo-2'",
		},
		{
			name: "different manager types - deny operation",
			existingResource: &unstructured.Unstructured{
				Object: map[string]interface{}{
					"metadata": map[string]interface{}{
						"name": "test-resource",
						"annotations": map[string]interface{}{
							utils.AnnoKeyManagerKind:     "terraform",
							utils.AnnoKeyManagerIdentity: "tf-stacks-1",
						},
					},
				},
			},
			requestingManager: utils.ManagerProperties{
				Kind:     utils.ManagerKindRepo,
				Identity: "repo-1",
			},
			expectError:     true,
			expectedMessage: "resource 'test-resource' is managed by terraform 'tf-stacks-1' and cannot be modified by repo 'repo-1'",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := CheckResourceOwnership(context.Background(), tt.existingResource, "test-resource", tt.requestingManager)

			if tt.expectError {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedMessage)
				assert.True(t, apierrors.IsBadRequest(err))
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestCheckResourceOwnership_TakeoverAllowlist(t *testing.T) {
	requestingManager := utils.ManagerProperties{
		Kind:     utils.ManagerKindRepo,
		Identity: "repo-1",
	}

	unmanagedResource := &unstructured.Unstructured{
		Object: map[string]interface{}{
			"apiVersion": "dashboard.grafana.app/v1",
			"kind":       "Dashboard",
			"metadata": map[string]interface{}{
				"name": "dash-abc",
			},
		},
	}

	t.Run("unmanaged resource rejected without allowlist", func(t *testing.T) {
		ctx := context.Background()
		err := CheckResourceOwnership(ctx, unmanagedResource, "dash-abc", requestingManager)
		require.Error(t, err)

		var unmanagedErr *ResourceUnmanagedConflictError
		assert.True(t, errors.As(err, &unmanagedErr))
	})

	t.Run("unmanaged resource allowed when in allowlist", func(t *testing.T) {
		allowlist := NewTakeoverAllowlist(map[ResourceIdentifier]struct{}{
			{Name: "dash-abc", Group: "dashboard.grafana.app", Kind: "Dashboard"}: {},
		})
		ctx := WithTakeoverAllowlist(context.Background(), allowlist)

		err := CheckResourceOwnership(ctx, unmanagedResource, "dash-abc", requestingManager)
		require.NoError(t, err)
	})

	t.Run("unmanaged resource rejected when not in allowlist", func(t *testing.T) {
		allowlist := NewTakeoverAllowlist(map[ResourceIdentifier]struct{}{
			{Name: "other-dash", Group: "dashboard.grafana.app", Kind: "Dashboard"}: {},
		})
		ctx := WithTakeoverAllowlist(context.Background(), allowlist)

		err := CheckResourceOwnership(ctx, unmanagedResource, "dash-abc", requestingManager)
		require.Error(t, err)

		var unmanagedErr *ResourceUnmanagedConflictError
		assert.True(t, errors.As(err, &unmanagedErr))
	})

	t.Run("empty allowlist still rejects unmanaged resource", func(t *testing.T) {
		allowlist := NewTakeoverAllowlist(map[ResourceIdentifier]struct{}{})
		ctx := WithTakeoverAllowlist(context.Background(), allowlist)

		err := CheckResourceOwnership(ctx, unmanagedResource, "dash-abc", requestingManager)
		require.Error(t, err)
	})

	t.Run("nil existing resource always allowed regardless of allowlist", func(t *testing.T) {
		ctx := context.Background()
		err := CheckResourceOwnership(ctx, nil, "dash-abc", requestingManager)
		require.NoError(t, err)
	})
}
