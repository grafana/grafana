package util

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCleanRelativePath(t *testing.T) {
	testcases := []struct {
		input         string
		expectedPath  string
		expectedError error
	}{
		{
			input:        "",
			expectedPath: ".",
		},
		{
			input:        "/test/test.txt",
			expectedPath: "test/test.txt",
		},
		{
			input:        "../../test/test.txt",
			expectedPath: "test/test.txt",
		},
		{
			input:        "./../test/test.txt",
			expectedPath: "test/test.txt",
		},
	}

	for _, tt := range testcases {
		path, err := CleanRelativePath(tt.input)
		if tt.expectedError != nil {
			assert.Error(t, err)
		} else {
			assert.NoError(t, err)
		}
		assert.Equal(t, tt.expectedPath, path)
	}
}
