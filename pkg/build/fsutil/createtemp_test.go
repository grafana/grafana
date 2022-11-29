package fsutil

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCreateTempFile(t *testing.T) {
	t.Run("empty suffix, expects pattern like: /var/folders/abcd/abcdefg/A/1137975807", func(t *testing.T) {
		filePath, err := CreateTempFile("")
		require.NoError(t, err)

		pathParts := strings.Split(filePath, "/")
		require.Greater(t, len(pathParts), 1)
		require.Len(t, strings.Split(pathParts[len(pathParts)-1], "-"), 1)
	})

	t.Run("non-empty suffix, expects /var/folders/abcd/abcdefg/A/1137975807-foobar", func(t *testing.T) {
		filePath, err := CreateTempFile("foobar")
		require.NoError(t, err)

		pathParts := strings.Split(filePath, "/")
		require.Greater(t, len(pathParts), 1)
		require.Len(t, strings.Split(pathParts[len(pathParts)-1], "-"), 2)
	})
}

func TestCreateTempDir(t *testing.T) {
	t.Run("empty suffix, expects pattern like: /var/folders/abcd/abcdefg/A/1137975807/", func(t *testing.T) {
		filePath, err := CreateTempFile("")
		require.NoError(t, err)

		pathParts := strings.Split(filePath, "/")
		require.Greater(t, len(pathParts), 1)
		require.Len(t, strings.Split(pathParts[len(pathParts)-1], "-"), 1)
	})

	t.Run("non-empty suffix, expects /var/folders/abcd/abcdefg/A/1137975807-foobar/", func(t *testing.T) {
		filePath, err := CreateTempFile("foobar")
		require.NoError(t, err)

		pathParts := strings.Split(filePath, "/")
		require.Greater(t, len(pathParts), 1)
		require.Len(t, strings.Split(pathParts[len(pathParts)-1], "-"), 2)
	})
}
