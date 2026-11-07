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

func TestTranslateActionToListParamsAll_ReturnsBothAnnotationResources(t *testing.T) {
	entries := TranslateActionToListParamsAll("annotations:read")
	require.Len(t, entries, 2)
	require.Contains(t, entries, ActionListEntry{
		Action: "annotations:read", Group: annotationGroup, Resource: annotationResource, Verb: "get",
	})
	require.Contains(t, entries, ActionListEntry{
		Action: "annotations:read", Group: dashboardGroup, Resource: dashboardResource, Subresource: annotationsSubresource, Verb: "get",
	})
}

func TestSupportedActions_DeterministicAndUnique(t *testing.T) {
	first := SupportedActions()
	second := SupportedActions()
	require.Equal(t, first, second)

	seen := map[string]struct{}{}
	for _, entry := range first {
		if _, ok := seen[entry.Action]; ok {
			t.Fatalf("duplicate action in supported actions: %s", entry.Action)
		}
		seen[entry.Action] = struct{}{}
		require.NotEmpty(t, entry.Group)
		require.NotEmpty(t, entry.Resource)
		require.NotEmpty(t, entry.Verb)
	}
}

func TestSupportedActionMappings_IncludesDistinctAnnotationResources(t *testing.T) {
	first := SupportedActionMappings()
	second := SupportedActionMappings()
	require.Equal(t, first, second)

	seen := map[ActionListEntry]struct{}{}
	annotationReadMappings := 0
	for _, entry := range first {
		if _, ok := seen[entry]; ok {
			t.Fatalf("duplicate resource mapping: %+v", entry)
		}
		seen[entry] = struct{}{}
		if entry.Action == "annotations:read" {
			annotationReadMappings++
		}
	}
	require.Equal(t, 2, annotationReadMappings)
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
