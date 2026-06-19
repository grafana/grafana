package search

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestESBulkActionMeta(t *testing.T) {
	t.Run("without version", func(t *testing.T) {
		meta := esBulkActionMeta("idx", "doc-1", 0)
		require.Equal(t, map[string]any{"_index": "idx", "_id": "doc-1"}, meta)
	})

	t.Run("with version", func(t *testing.T) {
		meta := esBulkActionMeta("idx", "doc-1", 42)
		require.Equal(t, map[string]any{
			"_index":       "idx",
			"_id":          "doc-1",
			"version":      int64(42),
			"version_type": "external_gte",
		}, meta)
	})
}
