package folders

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
)

func TestContinueToken(t *testing.T) {
	token, err := readContinueToken(&internalversion.ListOptions{})
	require.NoError(t, err)
	require.Equal(t, int64(100), token.limit)
	require.Equal(t, int64(0), token.page)

	next := token.GetNextPageToken()
	require.Equal(t, "MTAwfDE=", next)
	token, err = readContinueToken(&internalversion.ListOptions{Continue: next})
	require.NoError(t, err)
	require.Equal(t, int64(100), token.limit)
	require.Equal(t, int64(1), token.page) // <<< +1

	// Error if the limit has changed
	_, err = readContinueToken(&internalversion.ListOptions{Continue: next, Limit: 50})
	require.Error(t, err)
}
