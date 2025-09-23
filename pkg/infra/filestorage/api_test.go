package filestorage

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFilestorageApi_Join(t *testing.T) {
	var tests = []struct {
		name     string
		parts    []string
		expected string
	}{
		{
			name:     "multiple parts",
			parts:    []string{"prefix", "p1", "p2"},
			expected: "/prefix/p1/p2",
		},
		{
			name:     "no parts",
			parts:    []string{},
			expected: "/",
		},
		{
			name:     "a single part",
			parts:    []string{"prefix"},
			expected: "/prefix",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, Join(tt.parts...))
		})
	}
}

func pathPart(length int) string {
	sb := strings.Builder{}
	for i := 0; i < length; i++ {
		sb.WriteString("a")
	}
	return sb.String()
}

func TestFilestorageApi_ValidatePath(t *testing.T) {
	var tests = []struct {
		path          string
		expectedError error
	}{
		{
			path:          "abc/file.jpg",
			expectedError: ErrRelativePath,
		},
		{
			path:          "../abc/file.jpg",
			expectedError: ErrRelativePath,
		},
		{
			path:          "/abc/./file.jpg",
			expectedError: ErrNonCanonicalPath,
		},
		{
			path:          "/abc/../abc/file.jpg",
			expectedError: ErrNonCanonicalPath,
		},
		{
			path:          "/abc//folder/file.jpg",
			expectedError: ErrNonCanonicalPath,
		},
		{
			path:          "/abc/file.jpg/",
			expectedError: ErrPathEndsWithDelimiter,
		},
		{
			path:          "/abc/folder/ ",
			expectedError: ErrEmptyPathPart,
		},
		{
			path:          "/abc/ /file.jpg",
			expectedError: ErrEmptyPathPart,
		},
		{
			path:          "/abc/" + pathPart(260) + "/file.jpg",
			expectedError: ErrPathPartTooLong,
		},
		{
			path:          "/abc/" + pathPart(1050) + "/file.jpg",
			expectedError: ErrPathTooLong,
		},
		{
			path:          "/abc/folder🚀/file.jpg",
			expectedError: ErrInvalidCharacters,
		},
		{
			path:          "/path/with/utf/char/at/the/end.jpg�",
			expectedError: ErrInvalidCharacters,
		},
		{
			path: "/myFile/file.jpg",
		},
		{
			path: "/file.jpg",
		},
	}
	for _, tt := range tests {
		if tt.expectedError == nil {
			t.Run("path "+tt.path+" should be valid", func(t *testing.T) {
				require.Nil(t, ValidatePath(tt.path))
			})
		} else {
			t.Run("path "+tt.path+" should be invalid: "+tt.expectedError.Error(), func(t *testing.T) {
				require.Equal(t, tt.expectedError, ValidatePath(tt.path))
			})
		}
	}
}
