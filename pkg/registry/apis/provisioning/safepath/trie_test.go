package safepath

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTrie(t *testing.T) {
	tests := []struct {
		name          string
		pathsToAdd    []string
		pathsToCheck  []string
		expectedExist []bool
		expectedError error
	}{
		{
			name:          "empty trie",
			pathsToAdd:    []string{},
			pathsToCheck:  []string{"test", "test/"},
			expectedExist: []bool{false, false},
			expectedError: nil,
		},
		{
			name:          "single file",
			pathsToAdd:    []string{"test.json"},
			pathsToCheck:  []string{"test.json", "test.json/"},
			expectedExist: []bool{true, false},
			expectedError: nil,
		},
		{
			name:          "single directory",
			pathsToAdd:    []string{"test/"},
			pathsToCheck:  []string{"test", "test/"},
			expectedExist: []bool{false, true},
			expectedError: nil,
		},
		{
			name:          "nested structure",
			pathsToAdd:    []string{"folder/", "folder/file.txt", "folder/subfolder/", "folder/subfolder/test.json"},
			pathsToCheck:  []string{"folder/", "folder/file.txt", "folder/file.txt/", "folder/subfolder/", "folder/subfolder/test.json", "folder/subfolder/test.json/"},
			expectedExist: []bool{true, true, false, true, true, false},
			expectedError: nil,
		},
		{
			name:          "partial paths",
			pathsToAdd:    []string{"a/b/c/d/"},
			pathsToCheck:  []string{"a/", "a/b/", "a/b/c/", "a/b/c/d/"},
			expectedExist: []bool{true, true, true, true},
			expectedError: nil,
		},
		{
			name:          "file in middle of path",
			pathsToAdd:    []string{"a/file.txt", "a/file.txt/b/"},
			pathsToCheck:  []string{},
			expectedExist: []bool{},
			expectedError: fmt.Errorf("path %q exists but is not a directory", "a/file.txt"),
		},
		{
			name:          "empty path",
			pathsToAdd:    []string{""},
			pathsToCheck:  []string{""},
			expectedExist: []bool{true},
			expectedError: nil,
		},
		{
			name:          "root directory",
			pathsToAdd:    []string{"/"},
			pathsToCheck:  []string{"/", ""},
			expectedExist: []bool{true, true},
			expectedError: nil,
		},
		{
			name:          "duplicate paths",
			pathsToAdd:    []string{"test/", "test/"},
			pathsToCheck:  []string{"test/"},
			expectedExist: []bool{true},
			expectedError: nil,
		},
		{
			name:          "file to directory conversion not allowed",
			pathsToAdd:    []string{"test.txt", "test.txt/file.txt"},
			pathsToCheck:  []string{},
			expectedExist: []bool{},
			expectedError: fmt.Errorf("path %q exists but is not a directory", "test.txt"),
		},
		{
			name:          "directory to file conversion not allowed",
			pathsToAdd:    []string{"test/", "test"},
			pathsToCheck:  []string{},
			expectedExist: []bool{},
			expectedError: fmt.Errorf("path %q exists but is not a file", "test"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			trie := NewTrie()

			// Add paths
			var lastErr error
			for _, path := range tt.pathsToAdd {
				err := trie.Add(path)
				if err != nil {
					lastErr = err
					break
				}
			}

			if tt.expectedError != nil {
				require.Error(t, lastErr)
				require.Equal(t, tt.expectedError.Error(), lastErr.Error())
				return
			}
			require.NoError(t, lastErr)

			// Check existence
			for i, path := range tt.pathsToCheck {
				exists := trie.Exists(path)
				require.Equal(t, tt.expectedExist[i], exists, "path: %s", path)
			}
		})
	}
}
