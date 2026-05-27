package datasourcek8s

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestK8sDSActionToLegacy(t *testing.T) {
	tests := []struct {
		name           string
		action         string
		expectedAction string
		expectedOk     bool
	}{
		{
			name:           "query action without create verb not accepted",
			action:         "query.grafana.app/query",
			expectedAction: "",
			expectedOk:     false,
		},
		{
			name:           "query create action",
			action:         "query.grafana.app/query:create",
			expectedAction: "datasources:query",
			expectedOk:     true,
		},
		{
			name:           "non-datasource action",
			action:         "dashboards:read",
			expectedAction: "",
			expectedOk:     false,
		},
		{
			name:           "empty action",
			action:         "",
			expectedAction: "",
			expectedOk:     false,
		},
		{
			name:           "prefix only",
			action:         "query.grafana.app/",
			expectedAction: "",
			expectedOk:     false,
		},
		{
			name:           "datasource api group get verb",
			action:         "loki.datasource.grafana.app/datasources:get",
			expectedAction: "datasources:read",
			expectedOk:     true,
		},
		{
			name:           "datasource api group list verb",
			action:         "loki.datasource.grafana.app/datasources:list",
			expectedAction: "datasources:read",
			expectedOk:     true,
		},
		{
			name:           "datasource api group update verb",
			action:         "loki.datasource.grafana.app/datasources:update",
			expectedAction: "datasources:write",
			expectedOk:     true,
		},
		{
			name:           "datasource api group delete verb",
			action:         "loki.datasource.grafana.app/datasources:delete",
			expectedAction: "datasources:delete",
			expectedOk:     true,
		},
		{
			name:           "datasource api group unknown verb",
			action:         "loki.datasource.grafana.app/datasources:unknown",
			expectedAction: "",
			expectedOk:     false,
		},
		{
			name:           "wildcard datasource group",
			action:         "*.datasource.grafana.app/datasources:get",
			expectedAction: "datasources:read",
			expectedOk:     true,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			action, ok := K8sDSActionToLegacy(tc.action)
			require.Equal(t, tc.expectedOk, ok)
			require.Equal(t, tc.expectedAction, action)
		})
	}
}

func TestK8sDSUIDScopeToLegacy(t *testing.T) {
	scope, dsType, ok := K8sDSUIDScopeToLegacy("loki.datasource.grafana.app/datasources:abc")
	require.True(t, ok)
	require.Equal(t, "datasources:uid:abc", scope)
	require.Equal(t, "loki", dsType)

	scope, dsType, ok = K8sDSUIDScopeToLegacy("*.datasource.grafana.app/datasources:*")
	require.True(t, ok)
	require.Equal(t, "datasources:uid:*", scope)
	require.Equal(t, "*", dsType)
}
