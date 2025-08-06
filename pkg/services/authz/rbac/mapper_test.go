package rbac

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResourcePermissionTranslation(t *testing.T) {
	registry := NewMapperRegistry()

	// Test the dashboard example:
	// "group: iam.grafana.app, resource: resourcepermissions, name: dashboard.grafana.app_dashboards_dash123, verb: update"
	// Should translate to: "scope: dashboards:uid:dash123, action: dashboards.permissions:write"

	mapping, ok := registry.Get("iam.grafana.app", "resourcepermissions")
	require.True(t, ok, "resourcepermissions mapping should exist")

	// Test scope parsing for dashboard (using underscore delimiter)
	scope := mapping.Scope("dashboard.grafana.app_dashboards_dash123")
	assert.Equal(t, "dashboards:uid:dash123", scope, "should parse dashboard resource permission name correctly")

	// Test scope parsing for folder
	folderScope := mapping.Scope("folders.grafana.app_folders_fold123")
	assert.Equal(t, "folders:uid:fold123", folderScope, "should parse folder resource permission name correctly")

	// Test action mapping - now returns templates
	action, ok := mapping.Action("update")
	assert.True(t, ok, "update verb should be supported")
	assert.Equal(t, "{resource}.permissions:write", action, "update should map to resource template")

	// Test action mapping for read verbs
	readAction, ok := mapping.Action("get")
	assert.True(t, ok, "get verb should be supported")
	assert.Equal(t, "{resource}.permissions:read", readAction, "get should map to resource template")

	// Test ActionForResource method for specific resource types
	rp := mapping.(resourcePermissionTranslation)
	dashAction, ok := rp.ActionForResource("dashboards", "update")
	assert.True(t, ok, "should support dashboards")
	assert.Equal(t, "dashboards.permissions:write", dashAction, "should return dashboard-specific action")

	folderAction, ok := rp.ActionForResource("folders", "create")
	assert.True(t, ok, "should support folders")
	assert.Equal(t, "folders.permissions:write", folderAction, "should return folder-specific action")

	// Test complex dashboard ID with underscores
	complexScope := mapping.Scope("dashboard.grafana.app_dashboards_my_complex_dash_id")
	assert.Equal(t, "dashboards:uid:my_complex_dash_id", complexScope, "should handle dashboard IDs with underscores")

	// Test invalid format
	invalidScope := mapping.Scope("invalid-format")
	assert.Equal(t, "", invalidScope, "should return empty string for invalid format")
}

func TestResourcePermissionNameParsing(t *testing.T) {
	rp := newResourcePermissionTranslation().(resourcePermissionTranslation)

	tests := []struct {
		name             string
		input            string
		expectedGroup    string
		expectedResource string
		expectedID       string
		expectedSuccess  bool
	}{
		{
			name:             "simple dashboard permission",
			input:            "dashboard.grafana.app_dashboards_dash123",
			expectedGroup:    "dashboard.grafana.app",
			expectedResource: "dashboards",
			expectedID:       "dash123",
			expectedSuccess:  true,
		},
		{
			name:             "simple folder permission",
			input:            "folders.grafana.app_folders_fold123",
			expectedGroup:    "folders.grafana.app",
			expectedResource: "folders",
			expectedID:       "fold123",
			expectedSuccess:  true,
		},
		{
			name:             "resource with complex ID containing underscores",
			input:            "dashboard.grafana.app_dashboards_my_dashboard_with_underscores",
			expectedGroup:    "dashboard.grafana.app",
			expectedResource: "dashboards",
			expectedID:       "my_dashboard_with_underscores",
			expectedSuccess:  true,
		},
		{
			name:             "resource with UUID",
			input:            "dashboard.grafana.app_dashboards_123e4567-e89b-12d3-a456-426614174000",
			expectedGroup:    "dashboard.grafana.app",
			expectedResource: "dashboards",
			expectedID:       "123e4567-e89b-12d3-a456-426614174000",
			expectedSuccess:  true,
		},
		{
			name:            "invalid format - too few parts",
			input:           "dashboard_dashboards",
			expectedSuccess: false,
		},
		{
			name:            "invalid format - unsupported resource type",
			input:           "dashboard.grafana.app_unsupported_resource123",
			expectedSuccess: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			group, resourceType, id, success := rp.ParseResourcePermissionName(tt.input)
			assert.Equal(t, tt.expectedSuccess, success, "parsing success should match")
			if tt.expectedSuccess {
				assert.Equal(t, tt.expectedGroup, group, "group should match")
				assert.Equal(t, tt.expectedResource, resourceType, "resource type should match")
				assert.Equal(t, tt.expectedID, id, "ID should match")
			}
		})
	}
}
