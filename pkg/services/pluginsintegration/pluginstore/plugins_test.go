package pluginstore

import (
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/stretchr/testify/require"
)

func TestToGrafanaDTO(t *testing.T) {
	plugin := &plugins.Plugin{
		Translations: map[string]string{
			"en-US": "public/plugins/test-app/locales/en-US/test-app.json",
			"pt-BR": "public/plugins/test-app/locales/pt-BR/test-app.json",
		},
	}

	t.Run("Translations", func(t *testing.T) {
		dto := ToGrafanaDTO(plugin)
		require.Equal(t, plugin.Translations, dto.Translations)
	})
}
