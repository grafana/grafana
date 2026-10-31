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

func TestReportingPermissionTranslations(t *testing.T) {
	for _, tc := range []struct {
		action, kind, resource, verb string
		unscoped                     bool
	}{
		{"reports:read", "reports", "reports", "get", false},
		{"reports:create", "reports", "reports", "create", true},
		{"reports:write", "reports", "reports", "update", false},
		{"reports:delete", "reports", "reports", "delete", false},
		{"reports.settings:read", "reportsettings", "reportsettings", "get", true},
		{"reports.settings:write", "reportsettings", "reportsettings", "update", true},
	} {
		t.Run(tc.action, func(t *testing.T) {
			req, ok := TranslateToCheckRequest("default", tc.action, tc.kind, "weekly")
			require.True(t, ok)
			require.Equal(t, "reporting.grafana.app", req.Group)
			require.Equal(t, tc.resource, req.Resource)
			require.Equal(t, tc.verb, req.Verb)
			tuple, ok := TranslateToResourceTuple("user:1", tc.action, tc.kind, "*")
			require.True(t, ok)
			require.Equal(t, "group_resource:reporting.grafana.app/"+tc.resource, tuple.Object)
			_, ok = TranslateToResourceTuple("user:1", tc.action, "", "")
			require.Equal(t, tc.unscoped, ok)
			if !tc.unscoped {
				tuple, ok = TranslateToResourceTuple("user:1", tc.action, tc.kind, "weekly")
				require.True(t, ok)
				require.Equal(t, "resource:reporting.grafana.app/reports/weekly", tuple.Object)
			}
		})
	}
}

func TestReportingSettingsWriteTuples(t *testing.T) {
	tuples, ok := TranslateToResourceTuples("user:1", "reports.settings:write", "", "")
	require.True(t, ok)
	relations := make([]string, 0, len(tuples))
	for _, tuple := range tuples {
		require.Equal(t, "group_resource:reporting.grafana.app/reportsettings", tuple.Object)
		relations = append(relations, tuple.Relation)
	}
	require.ElementsMatch(t, []string{RelationCreate, RelationUpdate, RelationDelete}, relations)
}

func TestNativeReportingSettingsTuples(t *testing.T) {
	for _, relation := range []string{RelationGet, RelationCreate, RelationUpdate, RelationDelete} {
		for _, kind := range []string{"", "*", "reportsettings", "reporting.grafana.app/reportsettings"} {
			t.Run(relation+"/"+kind, func(t *testing.T) {
				tuples, ok := TranslateToResourceTuples("user:1", "reporting.grafana.app/reportsettings:"+relation, kind, "*")
				require.True(t, ok)
				require.Len(t, tuples, 1)
				require.Equal(t, "group_resource:reporting.grafana.app/reportsettings", tuples[0].Object)
				require.Equal(t, relation, tuples[0].Relation)
			})
		}
		_, ok := TranslateToResourceTuples("user:1", "reporting.grafana.app/reportsettings:"+relation, "dashboards", "*")
		require.False(t, ok, "a scope for another resource cannot grant settings access")
	}
}
