package inmemory

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func TestRoleDTOToV0GlobalRole(t *testing.T) {
	testTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)

	tests := []struct {
		name            string
		dto             *accesscontrol.RoleDTO
		expectedName    string
		expectedTitle   string
		expectedDesc    string
		expectedGroup   string
		expectedVersion string
		expectedHidden  bool
	}{
		{
			name: "basic admin role",
			dto: &accesscontrol.RoleDTO{
				UID:         "basic_admin",
				Name:        "basic:admin",
				DisplayName: "Admin",
				Description: "Admin role",
				Group:       "basic",
				Version:     1,
				Hidden:      false,
				Created:     testTime,
				Updated:     testTime,
				Permissions: []accesscontrol.Permission{
					{Action: "dashboards:read", Scope: "dashboards:uid:*"},
				},
			},
			expectedName:    "basic_admin",
			expectedTitle:   "Admin",
			expectedDesc:    "Admin role",
			expectedGroup:   "basic",
			expectedVersion: "1",
			expectedHidden:  false,
		},
		{
			name: "basic editor role",
			dto: &accesscontrol.RoleDTO{
				UID:         "basic_editor",
				Name:        "basic:editor",
				DisplayName: "Editor",
				Description: "Editor role",
				Group:       "basic",
				Version:     2,
				Hidden:      false,
				Created:     testTime,
				Updated:     testTime,
			},
			expectedName:    "basic_editor",
			expectedTitle:   "Editor",
			expectedDesc:    "Editor role",
			expectedGroup:   "basic",
			expectedVersion: "2",
			expectedHidden:  false,
		},
		{
			name: "basic viewer role",
			dto: &accesscontrol.RoleDTO{
				UID:         "basic_viewer",
				Name:        "basic:viewer",
				DisplayName: "Viewer",
				Description: "Viewer role",
				Group:       "basic",
				Version:     1,
				Hidden:      false,
				Created:     testTime,
				Updated:     testTime,
			},
			expectedName:    "basic_viewer",
			expectedTitle:   "Viewer",
			expectedDesc:    "Viewer role",
			expectedGroup:   "basic",
			expectedVersion: "1",
			expectedHidden:  false,
		},
		{
			name: "basic grafana admin role",
			dto: &accesscontrol.RoleDTO{
				UID:         "basic_grafana_admin",
				Name:        "basic:grafana_admin",
				DisplayName: "Grafana Admin",
				Description: "Grafana Admin role",
				Group:       "basic",
				Version:     3,
				Hidden:      false,
				Created:     testTime,
				Updated:     testTime,
			},
			expectedName:    "basic_grafana_admin",
			expectedTitle:   "Grafana Admin",
			expectedDesc:    "Grafana Admin role",
			expectedGroup:   "basic",
			expectedVersion: "3",
			expectedHidden:  false,
		},
		{
			name: "hidden basic none role",
			dto: &accesscontrol.RoleDTO{
				UID:         "basic_none",
				Name:        "basic:none",
				DisplayName: "No basic role",
				Description: "No basic role",
				Group:       "basic",
				Version:     1,
				Hidden:      true,
				Created:     testTime,
				Updated:     testTime,
			},
			expectedName:    "basic_none",
			expectedTitle:   "No basic role",
			expectedDesc:    "No basic role",
			expectedGroup:   "basic",
			expectedVersion: "1",
			expectedHidden:  true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := roleDTOToV0GlobalRole(tc.dto)

			// ObjectMeta.Name == UID
			assert.Equal(t, tc.expectedName, result.Name)
			assert.Equal(t, tc.expectedVersion, result.ResourceVersion)
			assert.Equal(t, tc.dto.Created, result.CreationTimestamp.Time)

			// Annotations
			assert.Equal(t, tc.dto.Name, result.Annotations[accesscontrol.RoleNameAnnotation])
			if tc.expectedHidden {
				assert.Equal(t, "true", result.Annotations[accesscontrol.RoleHiddenAnnotation])
			} else {
				_, exists := result.Annotations[accesscontrol.RoleHiddenAnnotation]
				assert.False(t, exists)
			}

			// Spec fields
			assert.Equal(t, tc.expectedTitle, result.Spec.Title)
			assert.Equal(t, tc.expectedDesc, result.Spec.Description)
			assert.Equal(t, tc.expectedGroup, result.Spec.Group)

			// Manager annotations
			assert.Equal(t, string(utils.ManagerKindGrafana), result.Annotations[utils.AnnoKeyManagerKind])
			assert.Equal(t, "grafana", result.Annotations[utils.AnnoKeyManagerIdentity])

			// UID should be non-empty (CalculateClusterWideUID)
			assert.NotEmpty(t, result.UID)

			// Generation should match version
			assert.Equal(t, tc.dto.Version, result.Generation)

			// Updated timestamp annotation
			assert.Equal(t, tc.dto.Updated.Format(time.RFC3339), result.Annotations[utils.AnnoKeyUpdatedTimestamp])
		})
	}
}

func TestToV0Permissions(t *testing.T) {
	perms := []accesscontrol.Permission{
		{Action: "dashboards:read", Scope: "dashboards:uid:*"},
		{Action: "folders:read", Scope: "folders:uid:abc"},
		{Action: "users:read", Scope: ""},
	}

	result := toV0Permissions(perms)

	require.Len(t, result, 3)
	assert.Equal(t, "dashboards:read", result[0].Action)
	assert.Equal(t, "dashboards:uid:*", result[0].Scope)
	assert.Equal(t, "folders:read", result[1].Action)
	assert.Equal(t, "folders:uid:abc", result[1].Scope)
	assert.Equal(t, "users:read", result[2].Action)
	assert.Equal(t, "", result[2].Scope)
}

func TestToV0PermissionsEmpty(t *testing.T) {
	result := toV0Permissions(nil)
	require.NotNil(t, result)
	require.Len(t, result, 0)
}

func TestRoleDTOToV0GlobalRolePermissionsPopulated(t *testing.T) {
	testTime := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	dto := &accesscontrol.RoleDTO{
		UID:         "basic_admin",
		Name:        "basic:admin",
		DisplayName: "Admin",
		Description: "Admin role",
		Group:       "basic",
		Version:     1,
		Created:     testTime,
		Updated:     testTime,
		Permissions: []accesscontrol.Permission{
			{Action: "dashboards:read", Scope: "dashboards:uid:*"},
			{Action: "dashboards:write", Scope: "dashboards:uid:*"},
			{Action: "folders:read", Scope: ""},
		},
	}

	result := roleDTOToV0GlobalRole(dto)
	require.Len(t, result.Spec.Permissions, 3)
	assert.Equal(t, "dashboards:read", result.Spec.Permissions[0].Action)
	assert.Equal(t, "dashboards:uid:*", result.Spec.Permissions[0].Scope)
	assert.Equal(t, "dashboards:write", result.Spec.Permissions[1].Action)
	assert.Equal(t, "folders:read", result.Spec.Permissions[2].Action)
}
