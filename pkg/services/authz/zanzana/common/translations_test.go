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
		require.Equal(t, []ActionListEntry{{Action: "dashboards:read", Group: expectedGroup, Resource: expectedResource, Verb: "get"}}, TranslateActionToListParams("dashboards:read"))
	}
}

func TestSupportedActions_DeterministicAndUnique(t *testing.T) {
	first := SupportedActions()
	second := SupportedActions()
	require.Equal(t, first, second)

	seen := map[ActionListEntry]struct{}{}
	for _, entry := range first {
		if _, ok := seen[entry]; ok {
			t.Fatalf("duplicate mapping in supported actions: %+v", entry)
		}
		seen[entry] = struct{}{}
		require.NotEmpty(t, entry.Group)
		require.NotEmpty(t, entry.Resource)
		require.NotEmpty(t, entry.Verb)
	}
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

func TestTranslateActionToListParams_AnnotationResources(t *testing.T) {
	for action, verb := range map[string]string{"annotations:read": "get", "annotations:create": "create", "annotations:write": "update", "annotations:delete": "delete"} {
		t.Run(action, func(t *testing.T) {
			require.Equal(t, []ActionListEntry{
				{Action: action, Group: "annotation.grafana.app", Resource: "annotations", Verb: verb},
				{Action: action, Group: "dashboard.grafana.app", Resource: "dashboards", Subresource: "annotations", Verb: verb},
			}, TranslateActionToListParams(action))
		})
	}
	require.Empty(t, TranslateActionToListParams("unknown:action"))
}
