package search

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseESBulkResponse(t *testing.T) {
	t.Run("no errors", func(t *testing.T) {
		raw := []byte(`{"errors":false,"items":[{"index":{"status":201}},{"delete":{"status":200}}]}`)
		result, err := parseESBulkResponse(raw)
		require.NoError(t, err)
		require.Equal(t, 2, result.Applied)
		require.Zero(t, result.Skipped)
	})

	t.Run("409 conflicts skipped", func(t *testing.T) {
		raw := []byte(`{"errors":true,"items":[
			{"index":{"status":409,"error":{"type":"version_conflict_engine_exception"}}},
			{"index":{"status":201}}
		]}`)
		result, err := parseESBulkResponse(raw)
		require.NoError(t, err)
		require.Equal(t, 1, result.Applied)
		require.Equal(t, 1, result.Skipped)
	})

	t.Run("non-409 item error fails", func(t *testing.T) {
		raw := []byte(`{"errors":true,"items":[{"index":{"status":400,"error":{"type":"mapper_parsing_exception"}}}]}`)
		_, err := parseESBulkResponse(raw)
		require.Error(t, err)
		require.Contains(t, err.Error(), "400")
	})
}
