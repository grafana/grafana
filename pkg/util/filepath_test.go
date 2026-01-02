package util

import (
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/plugins"
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
			input:        filepath.Join("..", "..", "test", "test.txt"),
			expectedPath: filepath.Join("test", "test.txt"),
		},
		{
			// since filepath.Join will remove the leading dot, we need to build the path manually
			input:        "." + string(filepath.Separator) + filepath.Join("..", "test", "test.txt"),
			expectedPath: filepath.Join("test", "test.txt"),
		},
	}

	for _, tt := range testcases {
		path, err := plugins.CleanRelativePath(tt.input)
		assert.NoError(t, err)
		assert.Equal(t, tt.expectedPath, path)
	}
}
