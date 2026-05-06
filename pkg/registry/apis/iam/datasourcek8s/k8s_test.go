package datasourcek8s

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestK8sDatasourceAPIGroup(t *testing.T) {
	assert.Equal(t, "loki.datasource.grafana.app", K8sDatasourceAPIGroup("loki"))
	assert.Equal(t, "*.datasource.grafana.app", K8sDatasourceAPIGroup("*"))
}

func TestLegacyUIDScopeToK8s(t *testing.T) {
	assert.Equal(t, "loki.datasource.grafana.app/datasources:abc", LegacyUIDScopeToK8s("loki", "abc"))
	assert.Equal(t, "*.datasource.grafana.app/datasources:*", LegacyUIDScopeToK8s("*", "*"))
}

func TestLegacyVerbToK8sAction(t *testing.T) {
	assert.Equal(t, "query.grafana.app/query:create", LegacyVerbToK8sAction("loki", "query"))
	assert.Equal(t, "loki.datasource.grafana.app/datasources:get", LegacyVerbToK8sAction("loki", "read"))
	assert.Equal(t, "*.datasource.grafana.app/datasources:update", LegacyVerbToK8sAction("*", "write"))
	assert.Equal(t, "datasources:custom", LegacyVerbToK8sAction("loki", "custom"))
}

func TestPluginTypeFromDatasourceAPIGroup(t *testing.T) {
	assert.Equal(t, "loki", DSTypeFromDatasourceAPIGroup("loki.datasource.grafana.app"))
	assert.Equal(t, "", DSTypeFromDatasourceAPIGroup("*.datasource.grafana.app"))
	assert.Equal(t, "", DSTypeFromDatasourceAPIGroup("folder.grafana.app"))
	assert.Equal(t, "", DSTypeFromDatasourceAPIGroup("foo.bar.datasource.grafana.app"))
}

func TestLegacyDatasourceScopeAndActionToK8s(t *testing.T) {
	scope, action := LegacyDatasourceScopeAndActionToK8s("", "datasources:uid:abc", "datasources:read")
	assert.Equal(t, "datasources:uid:abc", scope)
	assert.Equal(t, "datasources:read", action)

	scope, action = LegacyDatasourceScopeAndActionToK8s("loki", "datasources:uid:abc", "datasources:read")
	assert.Equal(t, "loki.datasource.grafana.app/datasources:abc", scope)
	assert.Equal(t, "loki.datasource.grafana.app/datasources:get", action)
}

func TestLegacyDatasourceAction(t *testing.T) {
	t.Run("maps simple verb", func(t *testing.T) {
		a := "datasources:read"
		LegacyDatasourceAction("loki", &a)
		assert.Equal(t, "loki.datasource.grafana.app/datasources:get", a)
	})
	t.Run("skips nested resource", func(t *testing.T) {
		a := "datasources.permissions:read"
		LegacyDatasourceAction("loki", &a)
		assert.Equal(t, "datasources.permissions:read", a)
	})
}
