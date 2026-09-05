package annotations

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestItemDTO_MarshalJSON(t *testing.T) {
	t.Run("always serializes alertId, including zero for manual annotations", func(t *testing.T) {
		b, err := json.Marshal(ItemDTO{ID: 1})
		require.NoError(t, err)

		var decoded map[string]any
		require.NoError(t, json.Unmarshal(b, &decoded))

		require.Contains(t, decoded, "alertId", "API consumers rely on the documented response shape")
		require.Equal(t, float64(0), decoded["alertId"])
	})

	t.Run("keeps internal-only fields omitted when unset", func(t *testing.T) {
		b, err := json.Marshal(ItemDTO{ID: 1})
		require.NoError(t, err)

		var decoded map[string]any
		require.NoError(t, json.Unmarshal(b, &decoded))

		require.NotContains(t, decoded, "dashboardId")
	})
}
