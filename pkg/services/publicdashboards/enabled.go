package publicdashboards

import (
	"context"

	"github.com/open-feature/go-sdk/openfeature"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var logger = log.New("publicdashboards")

// Enabled reports whether public dashboards are available for the stack
// handling this request.
//
// To be enabled, two independent switches must both allow it:
//
//   - cfg.PublicDashboardsEnabled: the operator's choice, set in ini.
//   - dashboards.disablePublicDashboards: a feature flag evaluated per
//     request, so the answer can differ per stack. In Grafana Cloud the
//     value comes from GOFF; self-managed instances source it from config.
//
// Evaluation errors fall back to false, so a flag provider failure leaves
// the feature working rather than disabling it.
func Enabled(ctx context.Context, cfg *setting.Cfg) bool {
	if !cfg.PublicDashboardsEnabled {
		return false
	}
	disabled, err := openfeature.NewDefaultClient().BooleanValue(
		ctx,
		featuremgmt.FlagDashboardsDisablePublicDashboards,
		false,
		openfeature.TransactionContext(ctx),
	)
	if err != nil {
		logger.Debug("flag evaluation failed, treating as not disabled", "error", err)
	}
	return !disabled
}
