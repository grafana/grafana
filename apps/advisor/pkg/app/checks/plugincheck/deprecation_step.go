package plugincheck

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginchecker"
)

const (
	DeprecationStepID = "deprecation"
)

type deprecationStep struct {
	GrafanaVersion string
	updateChecker  pluginchecker.PluginUpdateChecker
	pluginIndex    map[string]repo.PluginInfo
}

func (s *deprecationStep) Title() string {
	return "Deprecation check"
}

func (s *deprecationStep) Description() string {
	return "Check if any installed plugins are deprecated."
}

func (s *deprecationStep) Resolution() string {
	return "Check the <a href='https://grafana.com/legal/plugin-deprecation/#a-plugin-i-use-is-deprecated-what-should-i-do'" +
		"target=_blank>documentation</a> for recommended steps or delete the plugin."
}

func (s *deprecationStep) ID() string {
	return DeprecationStepID
}

func (s *deprecationStep) Run(ctx context.Context, log logging.Logger, _ *advisor.CheckSpec, it any) ([]advisor.CheckReportFailure, error) {
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

	// Check if plugin is deprecated
	i, ok := s.pluginIndex[p.ID]
	if !ok {
		// Unable to check deprecation status
		return nil, nil
	}
	if i.Status == "deprecated" {
		return []advisor.CheckReportFailure{checks.NewCheckReportFailure(
			advisor.CheckReportFailureSeverityHigh,
			s.ID(),
			p.Name,
			p.ID,
			[]advisor.CheckErrorLink{
				{
					Message: "View plugin",
					Url:     fmt.Sprintf("/plugins/%s", p.ID),
				},
			},
		)}, nil
	}
	return nil, nil
}
