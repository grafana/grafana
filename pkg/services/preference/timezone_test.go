package pref

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsValidTimezone(t *testing.T) {
	tests := []struct {
		timezone string
		valid    bool
	}{
		{
			timezone: "utc",
			valid:    true,
		},
		{
			timezone: "browser",
			valid:    true,
		},
		{
			timezone: "Europe/London",
			valid:    true,
		},
		{
			timezone: "invalid",
			valid:    false,
		},
		{
			timezone: "",
			valid:    true,
		},
	}
	for _, test := range tests {
		assert.Equal(t, test.valid, IsValidTimezone(test.timezone))
	}
}
