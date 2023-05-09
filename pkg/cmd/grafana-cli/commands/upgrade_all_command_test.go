package commands

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
	"github.com/grafana/grafana/pkg/plugins"
)

func TestVersionComparison(t *testing.T) {
	t.Run("Validate that version is outdated", func(t *testing.T) {
		versions := []models.Version{
			{Version: "1.1.1"},
			{Version: "2.0.0"},
		}

		upgradeablePlugins := []struct {
			have      plugins.FoundPlugin
			requested models.Plugin
		}{
			{
				have:      plugins.FoundPlugin{JSONData: plugins.JSONData{Info: plugins.Info{Version: "0.0.0"}}},
				requested: models.Plugin{Versions: versions},
			},
			{
				have:      plugins.FoundPlugin{JSONData: plugins.JSONData{Info: plugins.Info{Version: "1.0.0"}}},
				requested: models.Plugin{Versions: versions},
			},
		}

		for _, v := range upgradeablePlugins {
			t.Run(fmt.Sprintf("for %s should be true", v.have.JSONData.Info.Version), func(t *testing.T) {
				require.True(t, shouldUpgrade(v.have, v.requested))
			})
		}
	})

	t.Run("Validate that version is ok", func(t *testing.T) {
		versions := []models.Version{
			{Version: "1.1.1"},
			{Version: "2.0.0"},
		}

		shouldNotUpgrade := []struct {
			have      plugins.FoundPlugin
			requested models.Plugin
		}{
			{
				have:      plugins.FoundPlugin{JSONData: plugins.JSONData{Info: plugins.Info{Version: "2.0.0"}}},
				requested: models.Plugin{Versions: versions},
			},
			{
				have:      plugins.FoundPlugin{JSONData: plugins.JSONData{Info: plugins.Info{Version: "6.0.0"}}},
				requested: models.Plugin{Versions: versions},
			},
		}

		for _, v := range shouldNotUpgrade {
			t.Run(fmt.Sprintf("for %s should be false", v.have.JSONData.Info.Version), func(t *testing.T) {
				require.False(t, shouldUpgrade(v.have, v.requested))
			})
		}
	})
}
