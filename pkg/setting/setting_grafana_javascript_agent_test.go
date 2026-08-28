package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestReadGrafanaJavascriptAgentConfig(t *testing.T) {
	t.Run("TrackResources", func(t *testing.T) {
		cases := []struct {
			name     string
			iniValue *string // nil means no key set
			expected *bool
		}{
			{name: "nil when key absent"},
			{name: "nil when key is empty", iniValue: new("")},
			{name: "true when explicitly enabled", iniValue: new("true"), expected: new(true)},
			{name: "false when explicitly disabled", iniValue: new("false"), expected: new(false)},
		}

		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				iniFile := ini.Empty()
				if tc.iniValue != nil {
					section, err := iniFile.NewSection("log.frontend")
					require.NoError(t, err)

					_, err = section.NewKey("track_resources", *tc.iniValue)
					require.NoError(t, err)
				}

				cfg := &Cfg{Raw: iniFile}
				cfg.readGrafanaJavascriptAgentConfig()

				assert.Equal(t, tc.expected, cfg.GrafanaJavascriptAgent.TrackResources)
			})
		}
	})
}

//go:fix inline
func strPtr(s string) *string {
	return new(s)
}

//go:fix inline
func boolPtr(b bool) *bool {
	return new(b)
}
