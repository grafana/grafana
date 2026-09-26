package apis

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestOpenAPISnapshotEqual(t *testing.T) {
	t.Run("treats semantically equal documents as equal", func(t *testing.T) {
		equal, err := openAPISnapshotEqual(`{"paths":{"/api":{}},"openapi":"3.0.0"}`, `{"openapi":"3.0.0","paths":{"/api":{}}}`)

		require.NoError(t, err)
		require.True(t, equal)
	})

	t.Run("replaces malformed saved snapshots", func(t *testing.T) {
		equal, err := openAPISnapshotEqual(`{"openapi":`, `{"openapi":"3.0.0"}`)

		require.NoError(t, err)
		require.False(t, equal)
	})

	t.Run("rejects malformed server responses", func(t *testing.T) {
		equal, err := openAPISnapshotEqual(`{"openapi":"3.0.0"}`, `{"openapi":`)

		require.Error(t, err)
		require.False(t, equal)
	})
}
