package features

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/authlib/types"
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
//
// Authz for the POC requires a signed-in, non-anonymous identity. Per-notebook
// ACL checks (akin to DashboardHandler.HasDashboardAccess) are deferred until
// notebooks have a dedicated access service.
type NotebookHandler struct{}

// GetHandlerForPath called on init.
func (h *NotebookHandler) GetHandlerForPath(_ string) (model.ChannelHandler, error) {
	return h, nil // all notebooks share the same handler
}

// OnSubscribe allows signed-in org users to join a notebook session channel.
// Presence and join/leave are enabled so clients can render who is connected.
func (h *NotebookHandler) OnSubscribe(_ context.Context, user identity.Requester, e model.SubscribeEvent) (model.SubscribeReply, backend.SubscribeStreamStatus, error) {
	if !isNotebookChannelPath(e.Path) {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, nil
	}
	if err := requireSignedInNotebookUser(user); err != nil {
		return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, err
	}

	return model.SubscribeReply{
		Presence:  true,
		JoinLeave: true,
	}, backend.SubscribeStreamStatusOK, nil
}

// OnPublish relays collaboration events (cursor positions, document updates)
// to everyone subscribed to the notebook channel.
func (h *NotebookHandler) OnPublish(_ context.Context, user identity.Requester, e model.PublishEvent) (model.PublishReply, backend.PublishStreamStatus, error) {
	if !isNotebookChannelPath(e.Path) {
		return model.PublishReply{}, backend.PublishStreamStatusNotFound, nil
	}
	if err := requireSignedInNotebookUser(user); err != nil {
		return model.PublishReply{}, backend.PublishStreamStatusPermissionDenied, err
	}

	return model.PublishReply{Data: e.Data}, backend.PublishStreamStatusOK, nil
}

func isNotebookChannelPath(path string) bool {
	parts := strings.Split(path, "/")
	return len(parts) == 2 && parts[0] == "uid" && parts[1] != ""
}

func requireSignedInNotebookUser(user identity.Requester) error {
	if user == nil || user.IsNil() {
		return fmt.Errorf("missing user identity")
	}
	if user.IsIdentityType(types.TypeAnonymous) {
		return fmt.Errorf("anonymous access is not allowed")
	}
	if user.GetOrgID() < 1 {
		return fmt.Errorf("missing org identity")
	}
	return nil
}
