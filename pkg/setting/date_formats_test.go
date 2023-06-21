package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestValueAsTimezone(t *testing.T) {
	tests := map[string]struct {
		output string
		hasErr bool
	}{
		"browser":          {"browser", false},
		"UTC":              {"UTC", false},
		"Amsterdam":        {"browser", true},
		"Europe/Amsterdam": {"Europe/Amsterdam", false},
	}

	sec, err := ini.Empty().NewSection("test")
	require.NoError(t, err)
	key, err := sec.NewKey("test", "")
	require.NoError(t, err)

	for input, expected := range tests {
		key.SetValue(input)

		output, err := valueAsTimezone(sec, "test")

		assert.Equal(t, expected.hasErr, err != nil, "Invalid has err for input %q: %s", input, err)
		assert.Equal(t, expected.output, output, "Invalid output for input %q", input)
	}
}
