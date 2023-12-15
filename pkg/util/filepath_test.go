package util

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCleanRelativePath(t *testing.T) {
	testcases := []struct {
		input        string
		expectedPath string
	}{
		{
			input:        "",
			expectedPath: ".",
		},
		{
			input:        filepath.Join(string(filepath.Separator), "test", "test.txt"),
			expectedPath: filepath.Join("test", "test.txt"),
		},
		{
			input:        filepath.Join("..", string(filepath.Separator), "..", string(filepath.Separator), "test", "test.txt"),
			expectedPath: filepath.Join("test", "test.txt"),
		},
		{
			input:        filepath.Join(".", string(filepath.Separator), "..", string(filepath.Separator), "test", "test.txt"),
			expectedPath: filepath.Join("test", "test.txt"),
		},
	}

	for _, tt := range testcases {
		path, err := CleanRelativePath(tt.input)
		assert.NoError(t, err)
		assert.Equal(t, tt.expectedPath, path)
	}
}
