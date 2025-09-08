package resourcepermission

import (
	"context"
	"testing"
	"time"

	v0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/stretchr/testify/require"
)

// setupBackendNoDB sets up a ResourcePermSqlBackend with a no-op dbProvider for tests that do not require DB access.
func setupBackendNoDB(t *testing.T) *ResourcePermSqlBackend {
	noProvider := func(ctx context.Context) (*legacysql.LegacyDatabaseHelper, error) {
		return nil, nil
	}
	return ProvideStorageBackend(noProvider)
}

func TestToV0ResourcePermissions(t *testing.T) {
	backend := setupBackendNoDB(t)

	t.Run("empty permissions", func(t *testing.T) {
		result, err := backend.toV0ResourcePermissions([]rbacAssignment{})
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

		result, err := backend.toV0ResourcePermissions(permissions)
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
			result, err := backend.parseScope(tt.scope)
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
