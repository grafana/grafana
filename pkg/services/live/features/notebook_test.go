package features

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/live/model"
)

func TestNotebookHandler_OnSubscribe(t *testing.T) {
	h := &NotebookHandler{}

	t.Run("valid notebook path enables presence and join/leave", func(t *testing.T) {
		reply, status, err := h.OnSubscribe(context.Background(), nil, model.SubscribeEvent{Path: "uid/abc123"})
		require.NoError(t, err)
		require.Equal(t, backend.SubscribeStreamStatusOK, status)
		require.True(t, reply.Presence)
		require.True(t, reply.JoinLeave)
	})

	t.Run("unknown paths are rejected", func(t *testing.T) {
		for _, path := range []string{"", "uid", "uid/", "abc123", "uid/abc/extra"} {
			_, status, err := h.OnSubscribe(context.Background(), nil, model.SubscribeEvent{Path: path})
			require.NoError(t, err)
			require.Equal(t, backend.SubscribeStreamStatusNotFound, status, "path %q", path)
		}
	})
}

func TestNotebookHandler_OnPublish(t *testing.T) {
	h := &NotebookHandler{}

	t.Run("relays payload back for broadcast", func(t *testing.T) {
		data := json.RawMessage(`{"t":"cursor","x":10,"y":20}`)
		reply, status, err := h.OnPublish(context.Background(), nil, model.PublishEvent{Path: "uid/abc123", Data: data})
		require.NoError(t, err)
		require.Equal(t, backend.PublishStreamStatusOK, status)
		require.Equal(t, data, reply.Data)
	})

	t.Run("unknown paths are rejected", func(t *testing.T) {
		_, status, err := h.OnPublish(context.Background(), nil, model.PublishEvent{Path: "nope"})
		require.NoError(t, err)
		require.Equal(t, backend.PublishStreamStatusNotFound, status)
	})
}
