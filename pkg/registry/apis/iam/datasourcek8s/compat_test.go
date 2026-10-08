package datasourcek8s

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLegacyPermissionDoesNotBroadenPluginWildcard(t *testing.T) {
	for _, suffix := range []string{"*", "uid:*"} {
		action := "loki.datasource.grafana.app/datasources:get"
		scope := "loki.datasource.grafana.app/datasources:" + suffix
		gotAction, gotScope := LegacyPermission(action, scope)
		require.Equal(t, action, gotAction)
		require.Equal(t, scope, gotScope)
	}
}

func TestLegacyPermissionSupportedFormats(t *testing.T) {
	for _, group := range []string{
		"loki.datasource.grafana.app",
		"*.datasource.grafana.app",
		Group} {
		for old, legacy := range map[string]string{
			"get":             "datasources:read",
			"list":            "datasources:read",
			"watch":           "datasources:read",
			"update":          "datasources:write",
			"patch":           "datasources:write",
			"delete":          "datasources:delete",
			"get_permissions": "datasources.permissions:read",
			"set_permissions": "datasources.permissions:write",
		} {
			action, scope := LegacyPermission(group+"/datasources:"+old, group+"/datasources:uid:ds1")
			require.Equal(t, legacy, action)
			require.Equal(t, "datasources:uid:ds1", scope)
		}
	}
}

func TestLegacyPermissionLeavesUnrelatedAndMalformedPairsUnchanged(t *testing.T) {
	for _, tc := range []struct{ action, scope string }{
		{"loki.datasource.grafana.app/datasources:create", ""},
		{"datasource.grafana.app/datasources:get", ""},
		{"query.grafana.app/query:create", ""},
		{"dashboards:read", "dashboards:uid:ds1"},
		{"datasources:read", "datasources:uid:ds1"},
		{"loki.datasource.grafana.app/datasources:unknown", "loki.datasource.grafana.app/datasources:uid:ds1"},
		{"loki.datasource.grafana.app/datasources:get", "loki.datasource.grafana.app/datasources:uid:"},
		{"loki.datasource.grafana.app/datasources:get", "prometheus.datasource.grafana.app/datasources:uid:ds1"},
		{"loki.datasource.grafana.app/datasources:get", "dashboard.grafana.app/dashboards:uid:ds1"},
		{"query.grafana.app/query:create", "dashboards:uid:ds1"},
	} {
		action, scope := LegacyPermission(tc.action, tc.scope)
		require.Equal(t, tc.action, action)
		require.Equal(t, tc.scope, scope)
	}
}

func TestLegacyPermissionPreservesDatasourceCreateScope(t *testing.T) {
	for _, group := range []string{Group, "*" + K8sDatasourceAPIGroupSuffix, "loki.datasource.grafana.app"} {
		for _, suffix := range []string{"", "/datasources:*", "/datasources:uid:ds1"} {
			action := group + "/datasources:create"
			scope := ""
			if suffix != "" {
				scope = group + suffix
			}
			wantAction, wantScope := action, scope
			if group != "loki.datasource.grafana.app" && suffix != "/datasources:uid:ds1" {
				wantAction = "datasources:create"
				if suffix != "" {
					wantScope = "datasources:*"
				}
			}
			gotAction, gotScope := LegacyPermission(action, scope)
			require.Equal(t, wantAction, gotAction, "%s %s", action, scope)
			require.Equal(t, wantScope, gotScope, "%s %s", action, scope)
		}
	}
}
