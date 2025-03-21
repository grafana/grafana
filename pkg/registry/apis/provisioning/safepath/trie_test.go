package safepath

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTrie(t *testing.T) {
	tests := []struct {
		name          string
		pathsToAdd    []string
		pathsToCheck  []string
		expectedExist []bool
		expectError   bool
	}{
		{
			name:          "empty trie",
			pathsToAdd:    []string{},
			pathsToCheck:  []string{"test", "test/"},
			expectedExist: []bool{false, false},
			expectError:   false,
		},
		{
			name:          "single file",
			pathsToAdd:    []string{"test.json"},
			pathsToCheck:  []string{"test.json", "test.json/"},
			expectedExist: []bool{true, false},
			expectError:   false,
		},
		{
			name:          "single directory",
			pathsToAdd:    []string{"test/"},
			pathsToCheck:  []string{"test", "test/"},
			expectedExist: []bool{false, true},
			expectError:   false,
		},
		{
			name:          "nested structure",
			pathsToAdd:    []string{"folder/", "folder/file.txt", "folder/subfolder/", "folder/subfolder/test.json"},
			pathsToCheck:  []string{"folder/", "folder/file.txt", "folder/file.txt/", "folder/subfolder/", "folder/subfolder/test.json", "folder/subfolder/test.json/"},
			expectedExist: []bool{true, true, false, true, true, false},
			expectError:   false,
		},
		{
			name:          "partial paths",
			pathsToAdd:    []string{"a/b/c/d/"},
			pathsToCheck:  []string{"a/", "a/b/", "a/b/c/", "a/b/c/d/"},
			expectedExist: []bool{true, true, true, true},
			expectError:   false,
		},
		{
			name:          "file in middle of path",
			pathsToAdd:    []string{"a/file.txt", "a/file.txt/b/"},
			pathsToCheck:  []string{},
			expectedExist: []bool{},
			expectError:   true,
		},
		{
			name:          "empty path",
			pathsToAdd:    []string{""},
			pathsToCheck:  []string{""},
			expectedExist: []bool{true},
			expectError:   false,
		},
		{
			name:          "root directory",
			pathsToAdd:    []string{"/"},
			pathsToCheck:  []string{"/", ""},
			expectedExist: []bool{true, true},
			expectError:   false,
		},
		{
			name:          "duplicate paths",
			pathsToAdd:    []string{"test/", "test/"},
			pathsToCheck:  []string{"test/"},
			expectedExist: []bool{true},
			expectError:   false,
		},
		{
			name:          "file to directory conversion not allowed",
			pathsToAdd:    []string{"test.txt", "test.txt/file.txt"},
			pathsToCheck:  []string{},
			expectedExist: []bool{},
			expectError:   true,
		},
		{
			name:          "directory to file conversion not allowed",
			pathsToAdd:    []string{"test/", "test"},
			pathsToCheck:  []string{},
			expectedExist: []bool{},
			expectError:   true,
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

			if tt.expectError {
				require.Error(t, lastErr)
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
