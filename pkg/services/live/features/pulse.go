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
// underlying resource (currently always a dashboard).
type PulseHandler struct {
	AccessControl dashboards.DashboardAccessService
}

// GetHandlerForPath called on init.
func (h *PulseHandler) GetHandlerForPath(_ string) (model.ChannelHandler, error) {
	return h, nil
}

// OnSubscribe authorizes the subscription against the parent resource. We
// deliberately only support resources whose access can be checked through
// the dashboard access service for v1; non-dashboard kinds will be added
// when we wire their guardian counterparts.
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
