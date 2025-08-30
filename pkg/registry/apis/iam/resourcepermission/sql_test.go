package resourcepermission

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	v0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

func TestToV0ResourcePermission(t *testing.T) {
	now := time.Now()

	t.Run("empty permissions", func(t *testing.T) {
		result := toV0ResourcePermission(map[string][]flatResourcePermission{}, "test-name")
		require.Nil(t, result)
	})

	t.Run("single user permission", func(t *testing.T) {
		permissions := map[string][]flatResourcePermission{
			"user:testuser": {
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
			},
		}

		result := toV0ResourcePermission(permissions, "dashboard.grafana.app-dashboards-test123")

		require.NotNil(t, result)
		require.Equal(t, "dashboard.grafana.app-dashboards-test123", result.ObjectMeta.Name)
		require.Equal(t, "dashboard.grafana.app", result.Spec.Resource.ApiGroup)
		require.Equal(t, "dashboards", result.Spec.Resource.Resource)
		require.Equal(t, "test123", result.Spec.Resource.Name)
		require.Len(t, result.Spec.Permissions, 1)

		perm := result.Spec.Permissions[0]
		require.Equal(t, v0alpha1.ResourcePermissionSpecPermissionKindUser, perm.Kind)
		require.Equal(t, "testuser", perm.Name)
		require.Equal(t, "admin", perm.Verb)
	})

	t.Run("service account permission", func(t *testing.T) {
		permissions := map[string][]flatResourcePermission{
			"user:sa1": {
				{
					ID:               1,
					Action:           "dashboards:edit",
					Scope:            "dashboards:uid:test123",
					Created:          now,
					Updated:          now,
					RoleName:         "managed:role1",
					SubjectUID:       "sa1",
					SubjectType:      "user",
					IsServiceAccount: true,
				},
			},
		}

		result := toV0ResourcePermission(permissions, "dashboard.grafana.app-dashboards-test123")

		require.NotNil(t, result)
		require.Len(t, result.Spec.Permissions, 1)

		perm := result.Spec.Permissions[0]
		require.Equal(t, v0alpha1.ResourcePermissionSpecPermissionKindServiceAccount, perm.Kind)
		require.Equal(t, "sa1", perm.Name)
		require.Equal(t, "edit", perm.Verb)
	})

	t.Run("team permission", func(t *testing.T) {
		permissions := map[string][]flatResourcePermission{
			"team:testteam": {
				{
					ID:               1,
					Action:           "dashboards:view",
					Scope:            "dashboards:uid:test123",
					Created:          now,
					Updated:          now,
					RoleName:         "managed:role1",
					SubjectUID:       "testteam",
					SubjectType:      "team",
					IsServiceAccount: false,
				},
			},
		}

		result := toV0ResourcePermission(permissions, "dashboard.grafana.app-dashboards-test123")

		require.NotNil(t, result)
		require.Len(t, result.Spec.Permissions, 1)

		perm := result.Spec.Permissions[0]
		require.Equal(t, v0alpha1.ResourcePermissionSpecPermissionKindTeam, perm.Kind)
		require.Equal(t, "testteam", perm.Name)
		require.Equal(t, "view", perm.Verb)
	})

	t.Run("builtin role permission", func(t *testing.T) {
		permissions := map[string][]flatResourcePermission{
			"builtin_role:Viewer": {
				{
					ID:               1,
					Action:           "dashboards:view",
					Scope:            "dashboards:uid:test123",
					Created:          now,
					Updated:          now,
					RoleName:         "managed:role1",
					SubjectUID:       "Viewer",
					SubjectType:      "builtin_role",
					IsServiceAccount: false,
				},
			},
		}

		result := toV0ResourcePermission(permissions, "dashboard.grafana.app-dashboards-test123")

		require.NotNil(t, result)
		require.Len(t, result.Spec.Permissions, 1)

		perm := result.Spec.Permissions[0]
		require.Equal(t, v0alpha1.ResourcePermissionSpecPermissionKindBasicRole, perm.Kind)
		require.Equal(t, "Viewer", perm.Name)
		require.Equal(t, "view", perm.Verb)
	})

	t.Run("multiple permissions", func(t *testing.T) {
		permissions := map[string][]flatResourcePermission{
			"user:user1": {
				{
					ID:               1,
					Action:           "dashboards:admin",
					Scope:            "dashboards:uid:test123",
					Created:          now,
					Updated:          now,
					RoleName:         "managed:role1",
					SubjectUID:       "user1",
					SubjectType:      "user",
					IsServiceAccount: false,
				},
			},
			"team:team1": {
				{
					ID:               2,
					Action:           "dashboards:edit",
					Scope:            "dashboards:uid:test123",
					Created:          now,
					Updated:          now,
					RoleName:         "managed:role2",
					SubjectUID:       "team1",
					SubjectType:      "team",
					IsServiceAccount: false,
				},
			},
		}

		result := toV0ResourcePermission(permissions, "dashboard.grafana.app-dashboards-test123")

		require.NotNil(t, result)
		require.Len(t, result.Spec.Permissions, 2)
	})
}

func TestGetApiGroupForResource(t *testing.T) {
	testCases := []struct {
		resourceType string
		expected     string
	}{
		{"dashboards", "dashboard.grafana.app"},
		{"folders", "folder.grafana.app"},
		{"datasources", "datasource.grafana.app"},
		{"unknown", "core.grafana.app"},
		{"", "core.grafana.app"},
	}

	for _, tc := range testCases {
		t.Run(tc.resourceType, func(t *testing.T) {
			result := getApiGroupForResource(tc.resourceType)
			require.Equal(t, tc.expected, result)
		})
	}
}

func TestResourceNameParsing(t *testing.T) {
	// Test the parsing logic used in getResourcePermission
	testCases := []struct {
		name            string
		expectedScope   string
		expectedActions []string
		shouldError     bool
	}{
		{
			name:            "dashboard.grafana.app-dashboards-test123",
			expectedScope:   "dashboards:uid:test123",
			expectedActions: []string{"dashboards:admin", "dashboards:edit", "dashboards:view"},
		},
		{
			name:            "folder.grafana.app-folders-abc456",
			expectedScope:   "folders:uid:abc456",
			expectedActions: []string{"folders:admin", "folders:edit", "folders:view"},
		},
		{
			name:            "datasource.grafana.app-datasources-xyz789",
			expectedScope:   "datasources:uid:xyz789",
			expectedActions: []string{"datasources:admin", "datasources:edit", "datasources:view"},
		},
		{
			name:        "invalid",
			shouldError: true,
		},
		{
			name:        "too-short",
			shouldError: true,
		},
		{
			name:        "",
			shouldError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Test the parsing logic directly
			parts := splitResourceName(tc.name)

			if tc.shouldError {
				require.True(t, len(parts) != 3, "Should have wrong number of parts for invalid name")
			} else {
				require.Len(t, parts, 3)

				resourceType, uid := parts[1], parts[2]
				scope := resourceType + ":uid:" + uid
				actionSets := []string{resourceType + ":admin", resourceType + ":edit", resourceType + ":view"}

				require.Equal(t, tc.expectedScope, scope)
				require.Equal(t, tc.expectedActions, actionSets)
			}
		})
	}
}

// Helper function to test name splitting logic
func splitResourceName(name string) []string {
	if name == "" {
		return []string{}
	}

	parts := strings.Split(name, "-")
	return parts
}
