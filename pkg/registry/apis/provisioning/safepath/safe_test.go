package safepath

import (
	"errors"
	"strings"
	"testing"
)

func TestIsSafe(t *testing.T) {
	tests := []struct {
		name    string
		path    string
		wantErr error
	}{
		// Valid paths
		{
			name:    "valid simple path",
			path:    "path/to/resource",
			wantErr: nil,
		},
		{
			name:    "valid path with extension",
			path:    "path/to/file.json",
			wantErr: nil,
		},
		{
			name:    "valid directory path with trailing slash",
			path:    "path/to/folder/",
			wantErr: nil,
		},
		{
			name:    "valid path with allowed special chars",
			path:    "my-path/to_file/resource.json",
			wantErr: nil,
		},
		{
			name:    "empty path",
			path:    "",
			wantErr: nil,
		},
		{
			name:    "path at max length",
			path:    strings.Repeat("a", MaxPathLength),
			wantErr: nil,
		},
		{
			name:    "valid directory",
			path:    "path/to/",
			wantErr: nil,
		},
		{
			name:    "valid path with dots in filename",
			path:    "path/to/file.min.js",
			wantErr: nil,
		},
		// must be relative to the root
		{
			name:    "path with leading slash",
			path:    "/path/to/file.json",
			wantErr: ErrNotRelative,
		},
		// Length and depth limits
		{
			name:    "path too long",
			path:    strings.Repeat("a/", 512) + "file", // Creates path > MaxPathLength
			wantErr: ErrPathTooLong,
		},
		// Invalid characters and formats
		{
			name:    "invalid special character hash",
			path:    "path/to/file#.json",
			wantErr: ErrInvalidCharacters,
		},
		{
			name:    "invalid character space",
			path:    "path/to/my file.json",
			wantErr: ErrInvalidCharacters,
		},
		{
			name:    "invalid character backslash",
			path:    "path\\to\\file.json",
			wantErr: ErrInvalidCharacters,
		},
		{
			name:    "invalid character question mark",
			path:    "path/to/file?.json",
			wantErr: ErrInvalidCharacters,
		},
		{
			name:    "invalid character asterisk",
			path:    "path/to/*.json",
			wantErr: ErrInvalidCharacters,
		},

		// Double slashes
		{
			name:    "double slashes in middle",
			path:    "path//to/file.json",
			wantErr: ErrDoubleSlash,
		},
		{
			name:    "double slashes at start",
			path:    "//path/to/file.json",
			wantErr: ErrDoubleSlash,
		},
		{
			name:    "double slashes at end",
			path:    "path/to/file//",
			wantErr: ErrDoubleSlash,
		},

		// Hidden files and directories
		{
			name:    "hidden file",
			path:    "path/to/.hidden",
			wantErr: ErrHiddenPath,
		},
		{
			name:    "hidden directory",
			path:    "path/to/.git/",
			wantErr: ErrHiddenPath,
		},
		{
			name:    "hidden file with extension",
			path:    "path/to/.gitignore",
			wantErr: ErrHiddenPath,
		},
		{
			name:    "hidden path component in middle",
			path:    "path/.hidden/file.json",
			wantErr: ErrHiddenPath,
		},
		{
			name:    "hidden path at root",
			path:    ".env/config.json",
			wantErr: ErrHiddenPath,
		},

		// Path traversal attempts
		{
			name:    "path traversal with parent directory",
			path:    "path/to/../file.json",
			wantErr: ErrPathTraversalAttempt,
		},
		{
			name:    "path traversal at start",
			path:    "../path/file.json",
			wantErr: ErrPathTraversalAttempt,
		},
		{
			name:    "path traversal with multiple levels",
			path:    "path/../../file.json",
			wantErr: ErrPathTraversalAttempt,
		},
		{
			name:    "path traversal at end",
			path:    "path/to/folder/../",
			wantErr: ErrPathTraversalAttempt,
		},
		{
			name:    "single dot path component",
			path:    "path/to/./file.json",
			wantErr: ErrPathTraversalAttempt,
		},
		{
			name:    "double dot path component",
			path:    "path/to/../",
			wantErr: ErrPathTraversalAttempt,
		},

		// Current directory references
		{
			name:    "current directory at start",
			path:    "./path/file.json",
			wantErr: ErrPathTraversalAttempt,
		},
		{
			name:    "current directory in middle",
			path:    "path/./file.json",
			wantErr: ErrPathTraversalAttempt,
		},
		{
			name:    "current directory at end",
			path:    "path/to/./",
			wantErr: ErrPathTraversalAttempt,
		},

		// URL encoding attempts
		{
			name:    "percent character in filename",
			path:    "path/to/%20file.json",
			wantErr: ErrPercentChar,
		},
		{
			name:    "url encoded slash",
			path:    "path/to%2Ffile.json",
			wantErr: ErrPercentChar,
		},
		{
			name:    "url encoded dot",
			path:    "path/to%2E%2E/file.json",
			wantErr: ErrPercentChar,
		},
		{
			name:    "url encoded path traversal",
			path:    "path/to/%2e%2e/file.json",
			wantErr: ErrPercentChar,
		},
		{
			name:    "url encoded null byte",
			path:    "path/to/file%00.json",
			wantErr: ErrPercentChar,
		},

		// Mixed invalid patterns
		{
			name:    "mixed traversal attempts",
			path:    "./path/../file.json",
			wantErr: ErrPathTraversalAttempt,
		},
		{
			name:    "mixed special chars and traversal",
			path:    "../path/#/file.json",
			wantErr: ErrInvalidCharacters,
		},
		{
			name:    "mixed percent and special chars",
			path:    "path/%20/#/file.json",
			wantErr: ErrPercentChar,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := IsSafe(tt.path)
			if !errors.Is(err, tt.wantErr) {
				t.Errorf("IsSafe() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
