package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestLoadAnnotationAppPlatformSettings_MaxScopeCount(t *testing.T) {
	cases := []struct {
		name                  string
		iniValue              *string // nil means no key set
		expectedMaxScopeCount int
		expectErr             bool
	}{
		{name: "default when key absent", expectedMaxScopeCount: 5},
		{name: "explicit positive", iniValue: new("10"), expectedMaxScopeCount: 10},
		{name: "zero is accepted", iniValue: new("0"), expectedMaxScopeCount: 0},
		{name: "negative is rejected", iniValue: new("-1"), expectErr: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			iniFile := ini.Empty()
			if tc.iniValue != nil {
				section, err := iniFile.NewSection("annotations.app_platform")
				require.NoError(t, err)

				_, err = section.NewKey("max_scope_count", *tc.iniValue)
				require.NoError(t, err)
			}

			settings, err := loadAnnotationAppPlatformSettings(iniFile)
			if tc.expectErr {
				assert.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tc.expectedMaxScopeCount, settings.MaxScopeCount)
		})
	}
}
