package features

import (
	"context"
	"strings"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/live/model"
)

// PulseHandler manages all the `grafana/pulse/*` channels. It mirrors the
// shape of DashboardHandler so the Live router can register it alongside
// existing scopes. The handler is read-only from the client's perspective:
// publishes always come from the pulse service via the Publisher
// interface, so OnPublish refuses everything.
//
// Channel paths are `<resourceKind>/<resourceUID>`, scoped by org via the
// Live namespace mechanism. We authorize subscriptions against the
// underlying resource — dashboards go through DashboardAccessService and
// folders through the folder service's Get (which enforces the same
// permission model used by the browse-dashboards UI).
type PulseHandler struct {
	AccessControl dashboards.DashboardAccessService
	FolderService folder.Service
}

// GetHandlerForPath called on init.
func (h *PulseHandler) GetHandlerForPath(_ string) (model.ChannelHandler, error) {
	return h, nil
}

// OnSubscribe authorizes the subscription against the parent resource.
// Each supported kind delegates to its own permission surface so the
// live channel inherits the same access semantics as the REST API:
//
//   - dashboard: DashboardAccessService (the same access service that
//     guards /api/dashboards/uid/:uid reads).
//   - folder:    folder.Service.Get, which returns ErrAccessDenied when
//     the caller lacks folders:read on the folder.
//
// Unknown kinds collapse to NotFound so we never accidentally accept a
// subscription on a kind we haven't authorised.
func (h *PulseHandler) OnSubscribe(ctx context.Context, user identity.Requester, e model.SubscribeEvent) (model.SubscribeReply, backend.SubscribeStreamStatus, error) {
	parts := strings.Split(e.Path, "/")
	if len(parts) != 2 || parts[1] == "" {
		logger.Error("Unknown pulse channel", "path", e.Path)
		return model.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, nil
	}
	switch parts[0] {
	case "dashboard":
		ns := types.OrgNamespaceFormatter(user.GetOrgID())
		ok, err := h.AccessControl.HasDashboardAccess(ctx, user, utils.VerbGet, ns, parts[1])
		if !ok || err != nil {
			return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, err
		}
		return model.SubscribeReply{Presence: false, JoinLeave: false}, backend.SubscribeStreamStatusOK, nil
	case "folder":
		if h.FolderService == nil {
			logger.Error("Folder service not wired into PulseHandler")
			return model.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, nil
		}
		uid := parts[1]
		f, err := h.FolderService.Get(ctx, &folder.GetFolderQuery{
			UID:          &uid,
			OrgID:        user.GetOrgID(),
			SignedInUser: user,
		})
		if err != nil || f == nil {
			// Collapse access-denied and not-found to PermissionDenied to
			// avoid leaking folder existence to unauthorised subscribers.
			return model.SubscribeReply{}, backend.SubscribeStreamStatusPermissionDenied, err
		}
		return model.SubscribeReply{Presence: false, JoinLeave: false}, backend.SubscribeStreamStatusOK, nil
	}
	logger.Error("Unsupported pulse resource kind", "kind", parts[0])
	return model.SubscribeReply{}, backend.SubscribeStreamStatusNotFound, nil
}

// OnPublish refuses all client-initiated publishes. Pulse events are only
// produced by the server-side pulse service; opening this up would let an
// attacker fake a "pulse_added" event on any resource they can read.
func (h *PulseHandler) OnPublish(ctx context.Context, requester identity.Requester, e model.PublishEvent) (model.PublishReply, backend.PublishStreamStatus, error) {
	return model.PublishReply{}, backend.PublishStreamStatusPermissionDenied, nil
}
