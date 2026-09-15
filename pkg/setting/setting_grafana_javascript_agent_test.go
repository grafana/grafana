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
			{name: "nil when key is empty", iniValue: strPtr("")},
			{name: "true when explicitly enabled", iniValue: strPtr("true"), expected: boolPtr(true)},
			{name: "false when explicitly disabled", iniValue: strPtr("false"), expected: boolPtr(false)},
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

func strPtr(s string) *string {
	return &s
}

func boolPtr(b bool) *bool {
	return &b
}
