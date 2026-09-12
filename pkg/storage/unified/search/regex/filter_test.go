package regex

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFilterDictionaryPrefix(t *testing.T) {
	for _, tc := range []struct {
		expression string
		label      bool
		prefix     string
		complete   bool
	}{
		{"severity=critical.*", true, "severity=critical", false},
		{"severity=(?i)critical.*", true, "severity=", false},
		{"severity=critical", true, "severity=critical", true},
		{"prod-.*", false, "prod-", false},
		{"(?i)prod-.*", false, "", false},
	} {
		t.Run(tc.expression, func(t *testing.T) {
			filter, err := ParseFilter("field", tc.expression, tc.label)
			require.NoError(t, err)
			_, prefix, complete, err := filter.Compile()
			require.NoError(t, err)
			assert.Equal(t, tc.prefix, prefix)
			assert.Equal(t, tc.complete, complete)
		})
	}
	_, err := ParseFilter("labels", "severity=(?i)(?-i)foo", true)
	assert.EqualError(t, err, "invalid regex for field labels: regular expression disables leading case folding")
}
