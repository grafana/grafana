package common

import (
	"testing"

	dashboards "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/stretchr/testify/require"
)

func TestTranslateActionToListParams_UsesDeterministicMapping(t *testing.T) {
	expectedGroup := dashboards.DashboardResourceInfo.GroupResource().Group
	expectedResource := dashboards.DashboardResourceInfo.GroupResource().Resource

	for range 20 {
		group, resource, _, verb := TranslateActionToListParams("dashboards:read")
		require.Equal(t, expectedGroup, group)
		require.Equal(t, expectedResource, resource)
		require.Equal(t, "get", verb)
	}
}

func TestSupportedActions_DeterministicAndUnique(t *testing.T) {
	first := SupportedActions()
	second := SupportedActions()
	require.Equal(t, first, second)

	seen := map[ActionListEntry]struct{}{}
	for _, entry := range first {
		if _, ok := seen[entry]; ok {
			t.Fatalf("duplicate action mapping in supported actions: %+v", entry)
		}
		seen[entry] = struct{}{}
		require.NotEmpty(t, entry.Group)
		require.NotEmpty(t, entry.Resource)
		require.NotEmpty(t, entry.Verb)
	}
}

func TestTranslateActionToListParamsAll_ReturnsDistinctAnnotationMappings(t *testing.T) {
	want := []ActionListEntry{
		{Action: "annotations:read", Group: "annotation.grafana.app", Resource: "annotations", Verb: "get"},
		{Action: "annotations:read", Group: "dashboard.grafana.app", Resource: "dashboards", Subresource: "annotations", Verb: "get"},
	}

	require.ElementsMatch(t, want, TranslateActionToListParamsAll("annotations:read"))

	var supported []ActionListEntry
	for _, entry := range SupportedActions() {
		if entry.Action == "annotations:read" {
			supported = append(supported, entry)
		}
	}
	require.ElementsMatch(t, want, supported)
}

func TestDatasourceLegacyActionsUseSharedResource(t *testing.T) {
	for action, verb := range map[string]string{
		"datasources:read":              "get",
		"datasources:write":             "update",
		"datasources:delete":            "delete",
		"datasources:query":             "create",
		"datasources.permissions:read":  "get_permissions",
		"datasources.permissions:write": "set_permissions",
	} {
		t.Run(action, func(t *testing.T) {
			req, ok := TranslateToCheckRequest("stacks-1", action, "datasources", "ds1")
			require.True(t, ok)
			require.Equal(t, "datasource.grafana.app", req.Group)
			require.Equal(t, "datasources", req.Resource)
			require.Equal(t, verb, req.Verb)
			require.Equal(t, "ds1", req.Name)
			if action == "datasources:query" {
				require.Equal(t, "query", req.Subresource)
			} else {
				require.Empty(t, req.Subresource)
			}
		})
	}
}
