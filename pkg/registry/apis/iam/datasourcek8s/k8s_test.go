package datasourcek8s

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPluginTypeFromDatasourceAPIGroup(t *testing.T) {
	assert.Equal(t, "loki", DSTypeFromDatasourceAPIGroup("loki.datasource.grafana.app"))
	assert.Equal(t, "", DSTypeFromDatasourceAPIGroup("*.datasource.grafana.app"))
	assert.Equal(t, "", DSTypeFromDatasourceAPIGroup("folder.grafana.app"))
	assert.Equal(t, "", DSTypeFromDatasourceAPIGroup("foo.bar.datasource.grafana.app"))
}

func TestAuthorizationGroupPreservesOtherResources(t *testing.T) {
	for _, tc := range []struct{ group, resource string }{
		{"*.datasource.grafana.app", "datasources"},
		{"foo.bar.datasource.grafana.app", "datasources"},
		{".datasource.grafana.app", "datasources"},
		{"dashboard.grafana.app", "dashboards"},
		{"loki.datasource.grafana.app", "connections"},
	} {
		assert.Equal(t, tc.group, AuthorizationGroup(tc.group, tc.resource))
	}
}
