package expr

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBuildDSNodeDropsSingleFrameTable(t *testing.T) {
	s := &Service{}
	tr := AbsoluteTimeRange{}

	t.Run("removes the property and leaves the request untouched", func(t *testing.T) {
		rn := &rawNode{RefID: "A", TimeRange: tr, Query: map[string]any{"expr": "up", "format": "table", "singleFrameTable": true}}
		node, err := s.buildDSNode(nil, rn, &Request{})
		require.NoError(t, err)
		require.JSONEq(t, `{"expr":"up","format":"table"}`, string(node.query))
		require.Equal(t, true, rn.Query["singleFrameTable"])
	})

	t.Run("queries without the property are unchanged", func(t *testing.T) {
		rn := &rawNode{RefID: "A", TimeRange: tr, Query: map[string]any{"expr": "up", "intervalMs": 1000.0}}
		node, err := s.buildDSNode(nil, rn, &Request{})
		require.NoError(t, err)
		want, err := json.Marshal(rn.Query)
		require.NoError(t, err)
		require.Equal(t, string(want), string(node.query))
	})
}
