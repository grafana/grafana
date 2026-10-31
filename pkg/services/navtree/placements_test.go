package navtree

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseNavigationPlacements(t *testing.T) {
	t.Run("reads a section id with and without a weight", func(t *testing.T) {
		placements := ParseNavigationPlacements(map[string]string{
			"grafana-collector-app": "connections 1",
			"grafana-dbcfg-app":     "cfg",
		})

		assert.Equal(t, map[string]NavigationPlacement{
			"grafana-collector-app": {SectionID: "connections", SortWeight: 1},
			"grafana-dbcfg-app":     {SectionID: "cfg"},
		}, placements)
	})

	// Both trees sort a zero weight as "wherever it was appended", so a value we
	// cannot read is better dropped than guessed at
	t.Run("ignores an unparseable weight and an empty value", func(t *testing.T) {
		placements := ParseNavigationPlacements(map[string]string{
			"grafana-collector-app": "connections notanumber",
			"grafana-empty-app":     "",
		})

		assert.Equal(t, map[string]NavigationPlacement{
			"grafana-collector-app": {SectionID: "connections"},
		}, placements)
	})

	t.Run("returns nothing for a section with no keys", func(t *testing.T) {
		assert.Nil(t, ParseNavigationPlacements(map[string]string{}))
	})
}
