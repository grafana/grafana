package auditing_test

import (
	"encoding/json"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/apiserver/auditing"
	"github.com/stretchr/testify/require"
)

func TestEvent_MarshalJSON(t *testing.T) {
	t.Parallel()

	t.Run("marshals the event", func(t *testing.T) {
		t.Parallel()

		now := time.Now()

		event := auditing.Event{
			ObservedAt: now,
			Extra:      map[string]string{"k1": "v1", "k2": "v2"},
		}

		data, err := json.Marshal(event)
		require.NoError(t, err)

		var result map[string]any
		require.NoError(t, json.Unmarshal(data, &result))

		require.Equal(t, event.Time().UTC().Format(time.RFC3339Nano), result["observedAt"])
		require.NotNil(t, result["extra"])
		require.Len(t, result["extra"], 2)
	})
}

func TestEvent_KVPairs(t *testing.T) {
	t.Parallel()

	t.Run("records extra fields", func(t *testing.T) {
		t.Parallel()

		extraFields := 2
		extra := make(map[string]string, 0)
		for i := 0; i < extraFields; i++ {
			extra[strconv.Itoa(i)] = "value"
		}

		event := auditing.Event{Extra: extra}

		kvPairs := event.KVPairs()

		extraCount := 0
		for i := 0; i < len(kvPairs); i += 2 {
			if strings.HasPrefix(kvPairs[i].(string), "extra_") {
				extraCount++
			}
		}

		require.Equal(t, extraCount, extraFields)
	})
}
