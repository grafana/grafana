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

func TestActionListEntryLegacyScopeKind(t *testing.T) {
	for _, tc := range []struct {
		action, resource, kind string
	}{
		{"secret.securevalues:read", "securevalues", "secret.securevalues"},
		{"secret.securevalues.permissions:read", "securevalues", "secret.securevalues"},
		{"secret.securevalues.permissions:write", "securevalues", "secret.securevalues"},
		{"folders.permissions:read", "folders", "folders"},
		{"dashboards:read", "dashboards", "dashboards"},
		// Inherited notebook actions must retain notebook scopes.
		{"notebooks:read", "notebooks", "notebooks"},
		{"datasources.caching:read", "datasources", "datasources"},
	} {
		t.Run(tc.action, func(t *testing.T) {
			entry, ok := TranslateActionToListEntry(tc.action)
			require.True(t, ok)
			require.Equal(t, tc.resource, entry.Resource)
			require.Equal(t, tc.kind, entry.LegacyScopeKind)
			require.Contains(t, SupportedActions(), entry)
		})
	}

	entry, ok := TranslateActionToListEntry("unknown:read")
	require.False(t, ok)
	require.Empty(t, entry)
	group, resource, subresource, verb := TranslateActionToListParams("unknown:read")
	require.Empty(t, group)
	require.Empty(t, resource)
	require.Empty(t, subresource)
	require.Empty(t, verb)
}
