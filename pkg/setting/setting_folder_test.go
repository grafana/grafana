package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestMaxDeptFolderSettings(t *testing.T) {
	tests := []struct {
		name     string
		iniValue *string // nil means no key set
		noFile   bool
		expected int
	}{
		{
			name:     "returns default when ini file is nil",
			noFile:   true,
			expected: defaultMaxNestedFolderDepth,
		},
		{
			name:     "returns default when key is absent",
			expected: defaultMaxNestedFolderDepth,
		},
		{
			name:     "returns default when value is not a valid integer",
			iniValue: strp("notanint"),
			expected: defaultMaxNestedFolderDepth,
		},
		{
			name:     "returns default when value is zero",
			iniValue: strp("0"),
			expected: defaultMaxNestedFolderDepth,
		},
		{
			name:     "returns default when value is negative",
			iniValue: strp("-1"),
			expected: defaultMaxNestedFolderDepth,
		},
		{
			name:     "returns configured value when within range (3)",
			iniValue: strp("3"),
			expected: 3,
		},
		{
			name:     "returns configured value when within range (6)",
			iniValue: strp("6"),
			expected: 6,
		},
		{
			name:     "returns configured value when equals max",
			iniValue: strp("7"),
			expected: maxNestedFolderDepth,
		},
		{
			name:     "clamps to max when value exceeds max",
			iniValue: strp("100"),
			expected: maxNestedFolderDepth,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.noFile {
				assert.Equal(t, tt.expected, maxDeptFolderSettings(nil))
				return
			}

			f := ini.Empty()
			if tt.iniValue != nil {
				s, err := f.NewSection("folder")
				require.NoError(t, err)
				_, err = s.NewKey("max_nested_folder_depth", *tt.iniValue)
				require.NoError(t, err)
			}

			assert.Equal(t, tt.expected, maxDeptFolderSettings(f))
		})
	}
}

func strp(s string) *string { return &s }
