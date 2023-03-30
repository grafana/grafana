package fsutil_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/build/fsutil"
)

func TestExists_NonExistent(t *testing.T) {
	exists, err := fsutil.Exists("non-existent")
	require.NoError(t, err)

	require.False(t, exists)
}
