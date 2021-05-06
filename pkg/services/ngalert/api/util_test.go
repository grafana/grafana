package api

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestToMacaronPath(t *testing.T) {
	testCases := []struct {
		inputPath          string
		expectedOutputPath string
	}{
		{
			inputPath:          "",
			expectedOutputPath: "",
		},
		{
			inputPath:          "/ruler/{Recipient}/api/v1/rules/{Namespace}/{Groupname}",
			expectedOutputPath: "/ruler/:Recipient/api/v1/rules/:Namespace/:Groupname",
		},
	}
	for _, tc := range testCases {
		outputPath := toMacaronPath(tc.inputPath)
		assert.Equal(t, tc.expectedOutputPath, outputPath)
	}
}
