package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestLoadAnnotationAppPlatformSettings_MaxScopeCount(t *testing.T) {
	tests := []struct {
		name      string
		iniValue  *string // nil means no key set
		expected  int
		expectErr bool
	}{
		{name: "default when key absent", expected: 5},
		{name: "explicit positive", iniValue: new("10"), expected: 10},
		{name: "zero is accepted", iniValue: new("0"), expected: 0},
		{name: "negative is rejected", iniValue: new("-1"), expectErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := ini.Empty()
			if tt.iniValue != nil {
				s, err := f.NewSection("annotations.app_platform")
				require.NoError(t, err)
				_, err = s.NewKey("max_scope_count", *tt.iniValue)
				require.NoError(t, err)
			}

			got, err := loadAnnotationAppPlatformSettings(f)
			if tt.expectErr {
				assert.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.expected, got.MaxScopeCount)
		})
	}
}
