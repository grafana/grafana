package plugincheck

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/registry/apps/advisor/checks"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginchecker"
)

const (
	UpdateStepID = "update"
)

type updateStep struct {
	GrafanaVersion string
	updateChecker  pluginchecker.PluginUpdateChecker
	pluginIndex    map[string]repo.PluginInfo
}

func (s *updateStep) Title() string {
	return "Update check"
}

func (s *updateStep) Description() string {
	return "Checks if an installed plugins has a newer version available."
}

func (s *updateStep) Resolution() string {
	return "Go to the plugin admin page and upgrade to the latest version."
}

func (s *updateStep) ID() string {
	return UpdateStepID
}

func (s *updateStep) Run(ctx context.Context, log logging.Logger, _ *advisor.CheckSpec, it any) ([]advisor.CheckReportFailure, error) {
	pi, ok := it.(*pluginItem)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", it)
	}
	p := pi.Plugin
	if p == nil {
		return nil, nil
	}

	if !s.updateChecker.IsUpdatable(ctx, *p) {
		return nil, nil
	}

	// Check if plugin has a newer version available
	info, ok := s.pluginIndex[p.ID]
	if !ok {
		// Unable to check updates
		return nil, nil
	}
	if s.updateChecker.CanUpdate(p.ID, p.Info.Version, info.Version, false) {
		return []advisor.CheckReportFailure{checks.NewCheckReportFailure(
			advisor.CheckReportFailureSeverityLow,
			s.ID(),
			p.Name,
			p.ID,
			[]advisor.CheckErrorLink{
				{
					Message: "Upgrade",
					Url:     fmt.Sprintf("/plugins/%s?page=version-history", p.ID),
				},
			},
		)}, nil
	}

	return nil, nil
}
