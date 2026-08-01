package features

import (
	"context"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/live/model"
)

// NotebookHandler manages `grafana/notebook/uid/<uid>` channels used by the
// notebooks POC for collaborative editing: cursor presence and in-flight
// document sync between concurrent editors. Messages are relayed verbatim to
// every subscriber of the same channel (org isolation is enforced upstream by
// the org-prefixed channel id); nothing is persisted here — the notebooks
// resource API remains the source of truth for the saved document.
type NotebookHandler struct{}

// GetHandlerForPath called on init.
func (h *NotebookHandler) GetHandlerForPath(_ string) (model.ChannelHandler, error) {
	return h, nil // all notebooks share the same handler
}

// OnSubscribe allows any signed-in org user to join a notebook session channel.
// Presence and join/leave are enabled so clients can render who is connected.
func (h *NotebookHandler) OnSubscribe(_ context.Context, _ identity.Requester, e model.SubscribeEvent) (model.SubscribeReply, backend.SubscribeStreamStatus, error) {
	if !isNotebookChannelPath(e.Path) {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, nil
	}

	return model.SubscribeReply{
		Presence:  true,
		JoinLeave: true,
	}, backend.SubscribeStreamStatusOK, nil
}

// OnPublish relays collaboration events (cursor positions, document updates)
// to everyone subscribed to the notebook channel.
func (h *NotebookHandler) OnPublish(_ context.Context, _ identity.Requester, e model.PublishEvent) (model.PublishReply, backend.PublishStreamStatus, error) {
	if !isNotebookChannelPath(e.Path) {
		return model.PublishReply{}, backend.PublishStreamStatusNotFound, nil
	}

	return model.PublishReply{Data: e.Data}, backend.PublishStreamStatusOK, nil
}

func isNotebookChannelPath(path string) bool {
	parts := strings.Split(path, "/")
	return len(parts) == 2 && parts[0] == "uid" && parts[1] != ""
}
