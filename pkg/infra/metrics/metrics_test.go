package metrics

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLabelNameSanitization(t *testing.T) {
	testcases := []struct {
		input    string
		expected string
		err      bool
	}{
		{input: "job", expected: "job"},
		{input: "job._loal['", expected: "job_loal"},
		{input: "", expected: "", err: true},
		{input: ";;;", expected: "", err: true},
	}

	for _, tc := range testcases {
		got, err := SanitizeLabelName(tc.input)
		if tc.err {
			assert.Error(t, err)
		} else {
			require.NoError(t, err)
			assert.Equal(t, tc.expected, got)
		}
	}
}
