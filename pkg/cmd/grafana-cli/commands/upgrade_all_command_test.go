package commands

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/models"
)

func TestVersionComparison(t *testing.T) {
	t.Run("Validate that version is outdated", func(t *testing.T) {
		versions := []models.Version{
			{Version: "1.1.1"},
			{Version: "2.0.0"},
		}

		upgradeablePlugins := map[string]models.Plugin{
			"0.0.0": {Versions: versions},
			"1.0.0": {Versions: versions},
		}

		for k, v := range upgradeablePlugins {
			val := v
			t.Run(fmt.Sprintf("for %s should be true", k), func(t *testing.T) {
				assert.True(t, shouldUpgrade(k, &val))
			})
		}
	})

	t.Run("Validate that version is ok", func(t *testing.T) {
		versions := []models.Version{
			{Version: "1.1.1"},
			{Version: "2.0.0"},
		}

		shouldNotUpgrade := map[string]models.Plugin{
			"2.0.0": {Versions: versions},
			"6.0.0": {Versions: versions},
		}

		for k, v := range shouldNotUpgrade {
			val := v
			t.Run(fmt.Sprintf("for %s should be false", k), func(t *testing.T) {
				assert.False(t, shouldUpgrade(k, &val))
			})
		}
	})
}
