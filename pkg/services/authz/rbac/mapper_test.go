package rbac

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResourcePermissionTranslation(t *testing.T) {
	registry := NewMapperRegistry()

	// Test the dashboard example:
	// "group: iam.grafana.app, resource: resourcepermissions, name: dashboard.grafana.app-dashboards-dash123, verb: update"
	// Should translate to: "scope: dashboards:uid:dash123, action: dashboards.permissions:write"

	mapping, ok := registry.Get("iam.grafana.app", "resourcepermissions")
	require.True(t, ok, "resourcepermissions mapping should exist")

	// Test scope parsing for dashboard
	scope := mapping.Scope("dashboard.grafana.app-dashboards-dash123")
	assert.Equal(t, "dashboards:uid:dash123", scope, "should parse dashboard resource permission name correctly")

	// Test action mapping for update verb
	action, ok := mapping.Action("update")
	assert.True(t, ok, "update verb should be supported")
	assert.Equal(t, "dashboards.permissions:write", action, "update should map to dashboards.permissions:write")

	// Test action mapping for read verbs
	readAction, ok := mapping.Action("get")
	assert.True(t, ok, "get verb should be supported")
	assert.Equal(t, "dashboards.permissions:read", readAction, "get should map to dashboards.permissions:read")

	// Test action mapping for create verb
	createAction, ok := mapping.Action("create")
	assert.True(t, ok, "create verb should be supported")
	assert.Equal(t, "dashboards.permissions:write", createAction, "create should map to dashboards.permissions:write")

	// Test action mapping for delete verb
	deleteAction, ok := mapping.Action("delete")
	assert.True(t, ok, "delete verb should be supported")
	assert.Equal(t, "dashboards.permissions:write", deleteAction, "delete should map to dashboards.permissions:write")

	// Test complex dashboard ID with dashes
	complexScope := mapping.Scope("dashboard.grafana.app-dashboards-my-complex-dash-id")
	assert.Equal(t, "dashboards:uid:my-complex-dash-id", complexScope, "should handle dashboard IDs with dashes")

	// Test invalid format
	invalidScope := mapping.Scope("invalid-format")
	assert.Equal(t, "unknown:uid:invalid-format", invalidScope, "should handle invalid format gracefully")
}

func TestDashboardPermissionNameParsing(t *testing.T) {
	rp := newResourcePermissionTranslation().(resourcePermissionTranslation)

	tests := []struct {
		name                string
		input               string
		expectedDashboardID string
	}{
		{
			name:                "simple dashboard permission",
			input:               "dashboard.grafana.app-dashboards-dash123",
			expectedDashboardID: "dash123",
		},
		{
			name:                "dashboard with complex ID",
			input:               "dashboard.grafana.app-dashboards-my-dashboard-with-dashes",
			expectedDashboardID: "my-dashboard-with-dashes",
		},
		{
			name:                "dashboard with UUID",
			input:               "dashboard.grafana.app-dashboards-123e4567-e89b-12d3-a456-426614174000",
			expectedDashboardID: "123e4567-e89b-12d3-a456-426614174000",
		},
		{
			name:                "invalid format - too few parts",
			input:               "dashboard-dashboards",
			expectedDashboardID: "",
		},
		{
			name:                "invalid format - no dashboards keyword",
			input:               "dashboard.grafana.app-folders-fold1",
			expectedDashboardID: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dashboardID := rp.parseDashboardPermissionName(tt.input)
			assert.Equal(t, tt.expectedDashboardID, dashboardID, "dashboard ID should match")
		})
	}
}
