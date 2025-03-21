package safepath

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTrie_PathOperations(t *testing.T) {
	tests := []struct {
		name         string
		pathsToAdd   []string
		pathsToCheck map[string]bool // path -> expected existence
		description  string
	}{
		{
			name: "basic folder hierarchy",
			pathsToAdd: []string{
				"a/b/c/file.txt", // nested file
				"a/b/other.txt",  // file in middle directory
				"a/b/c",          // explicitly added directory
			},
			pathsToCheck: map[string]bool{
				"a/b/c/file.txt": true,  // exact file match
				"a/b/c":          true,  // explicitly added directory
				"a/b":            false, // parent directory not explicitly added
				"a":              false, // root directory not explicitly added
				"a/b/other.txt":  true,  // file in middle directory
				"a/b/c/":         true,  // directory with trailing slash
				"a/b/c/d":        false, // non-existent subdirectory
			},
			description: "testing basic directory hierarchy and partial path matching",
		},
		{
			name: "multiple files in same directory",
			pathsToAdd: []string{
				"x/y/file1.txt",
				"x/y/file2.txt",
				"x/y", // explicitly added directory
			},
			pathsToCheck: map[string]bool{
				"x/y/file1.txt": true,  // first file
				"x/y/file2.txt": true,  // second file
				"x/y":           true,  // explicitly added directory
				"x":             false, // parent not added
				"x/y/file3.txt": false, // non-existent file
				"x/y/":          true,  // directory with trailing slash
			},
			description: "testing multiple files in same directory and directory existence",
		},
		{
			name: "nested directory paths",
			pathsToAdd: []string{
				"1/2/3/4/5/file.txt",
				"1/2/3", // middle directory explicitly added
			},
			pathsToCheck: map[string]bool{
				"1/2/3/4/5/file.txt": true, // deeply nested file
				"1/2/3":              true, // explicitly added middle directory
				"1/2":                true, // parent not added
				"1":                  true, // root not added
				"1/2/3/4":            true, // child directory not explicitly added
				"1/2/3/4/5":          true, // child directory not explicitly added
				"1/2/3/":             true, // trailing slash on explicit directory
			},
			description: "testing deeply nested paths and partial directory matching",
		},
		{
			name: "multiple root directories",
			pathsToAdd: []string{
				"a/b/c/file.txt",
				"d/e/other.txt",
				"f/g/",
			},
			pathsToCheck: map[string]bool{
				"a/b/c/file.txt": true,
				"d/e/other.txt":  true,
				"f/g/":           true,
				"a/b/c":          true,
				"d/e":            true,
			},
		},
		{
			name: "only folder paths",
			pathsToAdd: []string{
				"a/b/c/",
				"d/e/f/",
				"g/h/",
			},
			pathsToCheck: map[string]bool{
				"a/b/c/": true,
				"d/e/f/": true,
				"g/h/":   true,
				"a/b/c":  false,
				"d/e/f":  false,
				"g/":     true,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			trie := NewTrie()

			// Add all paths to the trie
			for _, path := range tt.pathsToAdd {
				trie.Add(path)
			}

			// Check all paths against expected existence
			for pathToCheck, shouldExist := range tt.pathsToCheck {
				exists := trie.Exists(pathToCheck)
				require.Equal(t, shouldExist, exists,
					"Path '%s' existence mismatch. Expected: %v, Got: %v",
					pathToCheck, shouldExist, exists)
			}
		})
	}
}
