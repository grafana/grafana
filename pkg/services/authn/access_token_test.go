package authn

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsDatasourceGroup(t *testing.T) {
	for group, want := range map[string]bool{
		"loki.datasource.grafana.app":                          true,
		"grafana-postgresql-datasource.datasource.grafana.app": true,
		"datasource.grafana.app":                               false,
		".datasource.grafana.app":                              false,
		"foo.bar.datasource.grafana.app":                       false,
		"folder.grafana.app":                                   false,
		"example-aisdk-app":                                    false,
		"":                                                     false,
	} {
		require.Equal(t, want, isDatasourceGroup(group), group)
	}
}
