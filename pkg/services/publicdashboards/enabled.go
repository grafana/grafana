package publicdashboards

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// Enabled reports whether public dashboards are available for the stack
// handling this request.
//
// To be enabled, two independent switches must both allow it:
//
//   - cfg.PublicDashboardsEnabled: the operator's choice, set in ini.
//     A self-hosted admin who turned the feature off keeps it off.
//   - dashboards.disablePublicDashboards: Grafana Cloud's per-stack veto,
//     set via GOFF, used to withdraw the feature from the free tier.
//
// Evaluation errors fall back to false, so an unreachable flag
// service leaves the feature working.
func Enabled(ctx context.Context, cfg *setting.Cfg) bool {
	if !cfg.PublicDashboardsEnabled {
		return false
	}
	disabled, _ := openfeature.NewDefaultClient().BooleanValue(
		ctx,
		featuremgmt.FlagDashboardsDisablePublicDashboards,
		false,
		openfeature.TransactionContext(ctx),
	)
	return !disabled
}
