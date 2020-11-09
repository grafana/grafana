package setting

import (
	"testing"

	"gopkg.in/ini.v1"

	"github.com/stretchr/testify/assert"
)

func TestValueAsTimezone(t *testing.T) {
	tests := map[string]struct {
		output string
		hasErr bool
	}{
		"browser":          {"browser", false},
		"UTC":              {"UTC", false},
		"utc":              {"browser", true},
		"Amsterdam":        {"browser", true},
		"europe/amsterdam": {"browser", true},
		"Europe/Amsterdam": {"Europe/Amsterdam", false},
	}

	sec, err := ini.Empty().NewSection("test")
	assert.NoError(t, err)
	key, err := sec.NewKey("test", "")
	assert.NoError(t, err)

	for input, expected := range tests {
		key.SetValue(input)

		output, err := valueAsTimezone(sec, "test", "default")

		assert.Equal(t, expected.hasErr, err != nil, "Invalid has err for input: %s err: %v", input, err)
		assert.Equal(t, expected.output, output, "Invalid output for input: %s", input)
	}
}
