package setting

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestReadTimePicker(t *testing.T) {
	t.Run("Default values when quick_ranges not specified", func(t *testing.T) {
		cfg := NewCfg()
		iniContent := `
[time_picker]
`
		iniFile, err := ini.Load([]byte(iniContent))
		require.NoError(t, err)
		cfg.Raw = iniFile

		err = cfg.readTimePicker()
		require.NoError(t, err)

		// Default values should be used
		assert.Empty(t, cfg.QuickRanges)
	})

	t.Run("Parse valid quick_ranges", func(t *testing.T) {
		cfg := NewCfg()
		iniContent := `
[time_picker]
quick_ranges = [{"display":"Last 5 minutes","from":"now-5m","to":"now"},{"display":"Yesterday","from":"now-1d/d"},{"display":"Today so far","from":"now/d","to":"now"}]
`
		iniFile, err := ini.Load([]byte(iniContent))
		require.NoError(t, err)
		cfg.Raw = iniFile

		err = cfg.readTimePicker()
		require.NoError(t, err)

		// Validate parsed values
		require.Len(t, cfg.QuickRanges, 3)

		// First range
		assert.Equal(t, "Last 5 minutes", cfg.QuickRanges[0].Display)
		assert.Equal(t, "now-5m", cfg.QuickRanges[0].From)
		assert.Equal(t, "now", cfg.QuickRanges[0].To)

		// Second range (defaulted to 'now')
		assert.Equal(t, "Yesterday", cfg.QuickRanges[1].Display)
		assert.Equal(t, "now-1d/d", cfg.QuickRanges[1].From)
		assert.Equal(t, "now", cfg.QuickRanges[1].To)

		// Third range
		assert.Equal(t, "Today so far", cfg.QuickRanges[2].Display)
		assert.Equal(t, "now/d", cfg.QuickRanges[2].From)
		assert.Equal(t, "now", cfg.QuickRanges[2].To)
	})

	t.Run("QuickRange with missing To field gets default value", func(t *testing.T) {
		cfg := NewCfg()
		iniContent := `
[time_picker]
quick_ranges = [{"display":"Yesterday","from":"now-1d/d"}]
`
		iniFile, err := ini.Load([]byte(iniContent))
		require.NoError(t, err)
		cfg.Raw = iniFile

		err = cfg.readTimePicker()
		require.NoError(t, err)

		// Validate the parsed value
		require.Len(t, cfg.QuickRanges, 1)
		assert.Equal(t, "Yesterday", cfg.QuickRanges[0].Display)
		assert.Equal(t, "now-1d/d", cfg.QuickRanges[0].From)
		assert.Equal(t, "now", cfg.QuickRanges[0].To)

		jsonBytes, err := json.Marshal(cfg.QuickRanges)
		require.NoError(t, err)
		assert.Contains(t, string(jsonBytes), "\"to\":\"now\"")
	})

	t.Run("Invalid JSON format", func(t *testing.T) {
		cfg := NewCfg()
		iniContent := `
[time_picker]
quick_ranges = [{"display":"Last 5 minutes","from":"now-5m","to":"now"}, INVALID JSON]
`
		iniFile, err := ini.Load([]byte(iniContent))
		require.NoError(t, err)
		cfg.Raw = iniFile

		err = cfg.readTimePicker()
		require.Error(t, err)
		assert.True(t, strings.Contains(err.Error(), "failed to parse quick_ranges"))
	})

	t.Run("Missing display field", func(t *testing.T) {
		cfg := NewCfg()
		iniContent := `
[time_picker]
quick_ranges = [{"from":"now-5m","to":"now"}]
`
		iniFile, err := ini.Load([]byte(iniContent))
		require.NoError(t, err)
		cfg.Raw = iniFile

		err = cfg.readTimePicker()
		require.Error(t, err)
		assert.True(t, strings.Contains(err.Error(), "missing display name"))
	})

	t.Run("Missing from field", func(t *testing.T) {
		cfg := NewCfg()
		iniContent := `
[time_picker]
quick_ranges = [{"display":"Last 5 minutes","to":"now"}]
`
		iniFile, err := ini.Load([]byte(iniContent))
		require.NoError(t, err)
		cfg.Raw = iniFile

		err = cfg.readTimePicker()
		require.Error(t, err)
		assert.True(t, strings.Contains(err.Error(), "missing 'from' field"))
	})
}
