package fsutil_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/build/fsutil"
	"github.com/stretchr/testify/require"
)

func TestExists_NonExistent(t *testing.T) {
	exists, err := fsutil.Exists("non-existent")
	require.NoError(t, err)

	require.False(t, exists)
}
