package folders

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetParentTitles(t *testing.T) {
	path := "get\\/folder-folder-0/get\\/folder-folder-1/another"

	titles, err := GetParentTitles(path)
	require.Nil(t, err)
	require.Equal(t, 3, len(titles))
	require.Equal(t, "get\\/folder-folder-0", titles[0])
	require.Equal(t, "get\\/folder-folder-1", titles[1])
	require.Equal(t, "another", titles[2])
}
