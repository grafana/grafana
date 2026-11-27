package navtree

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestParseNavigationPlacements(t *testing.T) {
	// The section as an operator would write it, so the test exercises the same
	// value handling the ini file goes through
	section := func(t *testing.T, body string) *ini.Section {
		t.Helper()
		file, err := ini.Load([]byte(body))
		require.NoError(t, err)
		return file.Section("navigation.app_sections")
	}

	t.Run("reads a section id with and without a weight", func(t *testing.T) {
		placements := ParseNavigationPlacements(section(t, `
[navigation.app_sections]
grafana-collector-app = connections 1
grafana-dbcfg-app = cfg
`))

		assert.Equal(t, map[string]NavigationPlacement{
			"grafana-collector-app": {SectionID: "connections", SortWeight: 1},
			"grafana-dbcfg-app":     {SectionID: "cfg"},
		}, placements)
	})

	// Both trees sort a zero weight as "wherever it was appended", so a value we
	// cannot read is better dropped than guessed at
	t.Run("ignores an unparseable weight and an empty value", func(t *testing.T) {
		placements := ParseNavigationPlacements(section(t, `
[navigation.app_sections]
grafana-collector-app = connections notanumber
grafana-empty-app =
`))

		assert.Equal(t, map[string]NavigationPlacement{
			"grafana-collector-app": {SectionID: "connections"},
		}, placements)
	})

	// KeysHash would hand back "%(default_section)s" verbatim
	t.Run("expands a macro in the value", func(t *testing.T) {
		placements := ParseNavigationPlacements(section(t, `
default_section = connections
default_weight = 2

[navigation.app_sections]
grafana-collector-app = %(default_section)s %(default_weight)s
`))

		assert.Equal(t, map[string]NavigationPlacement{
			"grafana-collector-app": {SectionID: "connections", SortWeight: 2},
		}, placements)
	})

	t.Run("returns nothing for a section with no keys", func(t *testing.T) {
		assert.Nil(t, ParseNavigationPlacements(ini.Empty().Section("navigation.app_sections")))
	})
}
