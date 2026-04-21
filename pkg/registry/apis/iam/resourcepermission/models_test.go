package resourcepermission

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/authlib/types"

	v0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

// setupBackendNoDB sets up a ResourcePermSqlBackend with a no-op dbProvider for tests that do not require DB access.
func setupBackendNoDB(t *testing.T) *ResourcePermSqlBackend {
	noProvider := func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return nil, nil
	}
	return ProvideStorageBackend(noProvider, NewMappersRegistry())
}

func TestToV0ResourcePermissions(t *testing.T) {
	backend := setupBackendNoDB(t)

	ns := types.NamespaceInfo{Value: "default"}

	t.Run("empty permissions", func(t *testing.T) {
		result, err := backend.toV0ResourcePermissions(context.Background(), ns, []rbacAssignment{})
		require.NoError(t, err)
		require.Nil(t, result)
	})

	now := time.Now()
	t.Run("multiple permission are sorted by kind, name, verb", func(t *testing.T) {
		permissions := []rbacAssignment{
			{
				ID:               1,
				Action:           "dashboards:admin",
				Scope:            "dashboards:uid:test123",
				Created:          now,
				Updated:          now,
				RoleName:         "managed:role1",
				SubjectUID:       "testuser",
				SubjectType:      "user",
				IsServiceAccount: false,
			},
			{
				ID:               2,
				Action:           "dashboards:edit",
				Scope:            "dashboards:uid:test123",
				Created:          now,
				Updated:          now,
				RoleName:         "managed:role1",
				SubjectUID:       "sa1",
				SubjectType:      "user",
				IsServiceAccount: true,
			},
			{
				ID:               3,
				Action:           "dashboards:view",
				Scope:            "dashboards:uid:test123",
				Created:          now,
				Updated:          now,
				RoleName:         "managed:role1",
				SubjectUID:       "testteam",
				SubjectType:      "team",
				IsServiceAccount: false,
			},
			{
				ID:               4,
				Action:           "dashboards:view",
				Scope:            "dashboards:uid:test123",
				Created:          now,
				Updated:          now,
				RoleName:         "managed:role1",
				SubjectUID:       "Viewer",
				SubjectType:      "builtin_role",
				IsServiceAccount: false,
			},
		}

		result, err := backend.toV0ResourcePermissions(context.Background(), ns, permissions)
		require.NoError(t, err)
		require.NotNil(t, result)
		require.Len(t, result, 1)
		require.Len(t, result[0].Spec.Permissions, 4)

		perm := result[0].Spec.Permissions[0]
		require.Equal(t, v0alpha1.ResourcePermissionSpecPermissionKindBasicRole, perm.Kind)
		require.Equal(t, "Viewer", perm.Name)
		require.Equal(t, "view", perm.Verb)
		perm = result[0].Spec.Permissions[1]
		require.Equal(t, v0alpha1.ResourcePermissionSpecPermissionKindServiceAccount, perm.Kind)
		require.Equal(t, "sa1", perm.Name)
		require.Equal(t, "edit", perm.Verb)
		perm = result[0].Spec.Permissions[2]
		require.Equal(t, v0alpha1.ResourcePermissionSpecPermissionKindTeam, perm.Kind)
		require.Equal(t, "testteam", perm.Name)
		require.Equal(t, "view", perm.Verb)
		perm = result[0].Spec.Permissions[3]
		require.Equal(t, v0alpha1.ResourcePermissionSpecPermissionKindUser, perm.Kind)
		require.Equal(t, "testuser", perm.Name)
		require.Equal(t, "admin", perm.Verb)
	})
}

func TestParseScope(t *testing.T) {
	backend := setupBackendNoDB(t)

	tests := []struct {
		name        string
		scope       string
		expected    *groupResourceName
		expectError error
	}{
		{
			name:  "valid scope",
			scope: "dashboards:uid:dash1",
			expected: &groupResourceName{
				Group:    "dashboard.grafana.app",
				Resource: "dashboards",
				Name:     "dash1",
			},
		},
		{
			name:        "invalid scope format",
			scope:       "dashboards:someotherformat",
			expected:    nil,
			expectError: errInvalidScope,
		},
		{
			name:        "unknown group resource",
			scope:       "unknown:uid:u1",
			expected:    nil,
			expectError: errUnknownGroupResource,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := backend.ParseScope(tt.scope, "")
			if tt.expectError != nil {
				require.ErrorIs(t, err, tt.expectError)
				return
			}

			require.NoError(t, err)
			require.NotNil(t, result)
			require.Equal(t, tt.expected.Group, result.Group)
			require.Equal(t, tt.expected.Resource, result.Resource)
			require.Equal(t, tt.expected.Name, result.Name)
		})
	}
}

// --- toV0ResourcePermissions with SA resolver ---

func setupBackendWithResolver(t *testing.T, resolver NameResolver) *ResourcePermSqlBackend {
	noProvider := func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return nil, nil
	}
	mappers := NewMappersRegistry()
	backend := ProvideStorageBackend(noProvider, mappers)
	saGR := schema.GroupResource{Group: "iam.grafana.app", Resource: "serviceaccounts"}
	mappers.RegisterResolver(saGR, resolver)
	return backend
}

func TestToV0ResourcePermissions_SAResolver(t *testing.T) {
	ctx := context.Background()
	ns := types.NamespaceInfo{Value: "org-1"}
	now := time.Now()

	saAssignment := rbacAssignment{
		ID:          1,
		Action:      "serviceaccounts:edit",
		Scope:       "serviceaccounts:id:42",
		Created:     now,
		Updated:     now,
		SubjectUID:  "user-1",
		SubjectType: "user",
	}

	t.Run("IDToUIDMap pre-loads cache, SA name resolves to UID", func(t *testing.T) {
		resolver := &mockNameResolver{idToUID: map[string]string{"42": "sa-uid-abc"}}
		backend := setupBackendWithResolver(t, resolver)

		result, err := backend.toV0ResourcePermissions(ctx, ns, []rbacAssignment{saAssignment})
		require.NoError(t, err)
		require.Len(t, result, 1)
		assert.Equal(t, "sa-uid-abc", result[0].Spec.Resource.Name)
		assert.Equal(t, "serviceaccounts", result[0].Spec.Resource.Resource)
		assert.Equal(t, "iam.grafana.app", result[0].Spec.Resource.ApiGroup)
	})

	t.Run("IDToUIDMap failure falls back to per-scope IDToUID", func(t *testing.T) {
		// Pre-load fails but per-scope lookup succeeds
		resolver := &mockNameResolver{
			idToUID:       map[string]string{"42": "sa-uid-abc"},
			idToUIDMapErr: errors.New("k8s timeout"),
		}
		backend := setupBackendWithResolver(t, resolver)

		result, err := backend.toV0ResourcePermissions(ctx, ns, []rbacAssignment{saAssignment})
		require.NoError(t, err)
		require.Len(t, result, 1)
		assert.Equal(t, "sa-uid-abc", result[0].Spec.Resource.Name)
	})

	t.Run("both IDToUIDMap and IDToUID fail: error returned", func(t *testing.T) {
		resolver := &mockNameResolver{
			idToUIDMapErr: errors.New("k8s unavailable"),
			idToUIDErr:    errors.New("k8s unavailable"),
		}
		backend := setupBackendWithResolver(t, resolver)

		_, err := backend.toV0ResourcePermissions(ctx, ns, []rbacAssignment{saAssignment})
		require.Error(t, err)
	})
}
