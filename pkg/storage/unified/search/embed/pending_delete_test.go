package embed

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func labeledValue(t *testing.T, pendingDelete bool) []byte {
	t.Helper()
	metadata := map[string]any{"name": "dash-1"}
	if pendingDelete {
		metadata["labels"] = map[string]any{LabelPendingDelete: "true"}
	}
	b, err := json.Marshal(map[string]any{"metadata": metadata, "spec": map[string]any{"title": "x"}})
	require.NoError(t, err)
	return b
}

func TestHasPendingDeleteLabel(t *testing.T) {
	t.Run("label present returns true", func(t *testing.T) {
		assert.True(t, HasPendingDeleteLabel(labeledValue(t, true)))
	})
	t.Run("label absent returns false", func(t *testing.T) {
		assert.False(t, HasPendingDeleteLabel(labeledValue(t, false)))
	})
	t.Run("no metadata returns false", func(t *testing.T) {
		assert.False(t, HasPendingDeleteLabel([]byte(`{"spec":{"title":"x"}}`)))
	})
	t.Run("empty value returns false", func(t *testing.T) {
		assert.False(t, HasPendingDeleteLabel(nil))
	})
	t.Run("malformed JSON fails open to false", func(t *testing.T) {
		assert.False(t, HasPendingDeleteLabel([]byte(`{not json`)))
	})
	t.Run("label set to a non-true value returns false", func(t *testing.T) {
		assert.False(t, HasPendingDeleteLabel([]byte(`{"metadata":{"labels":{"cloud.grafana.com/pending-delete":"false"}}}`)))
	})
}
