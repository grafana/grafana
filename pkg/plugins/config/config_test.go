package config

import (
	"testing"

	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/setting"

	"github.com/stretchr/testify/require"
)

func TestPluginSettings(t *testing.T) {
	raw, err := ini.Load([]byte(`
		[plugins]
		test_key = 123

		[plugin.test-datasource]
		foo = 5m
		bar = something`))
	require.NoError(t, err)

	cfg := &setting.Cfg{Raw: raw}
	settings := &setting.OSSImpl{Cfg: cfg}

	ps := extractPluginSettings(settings)
	require.Len(t, ps, 1)
	require.Len(t, ps["test-datasource"], 2)
	require.Equal(t, ps["test-datasource"]["foo"], "5m")
	require.Equal(t, ps["test-datasource"]["bar"], "something")
}
