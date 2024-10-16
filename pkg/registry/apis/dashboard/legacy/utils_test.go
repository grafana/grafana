package legacy

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestVersionHacks(t *testing.T) {
	rv := getResourceVersion(123, 456)
	require.Equal(t, int64(1230000456), rv)
	require.Equal(t, int64(456), getVersionFromRV(rv))
}
