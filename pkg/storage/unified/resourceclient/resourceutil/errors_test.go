package resourceutil

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStatusErrorFromGRPC_NilReturnsNil(t *testing.T) {
	t.Parallel()
	require.NoError(t, StatusErrorFromGRPC(nil))
}
