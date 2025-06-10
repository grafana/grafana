package plugincheck

import (
	"context"
	"fmt"
	"slices"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
)

const (
	UnsignedStepID = "unsigned"
)

type unsignedStep struct {
	pluginIndex map[string]repo.PluginInfo
}

func (s *unsignedStep) Title() string {
	return "Plugin signature check"
}

func (s *unsignedStep) Description() string {
	return "Checks has a missing or invalid signature."
}

func (s *unsignedStep) Resolution() string {
	return "For security, we recommend only installing plugins from the catalog. " +
		"Review the plugin's status and verify your allowlist if appropriate."
}

func (s *unsignedStep) ID() string {
	return UnsignedStepID
}

func (s *unsignedStep) Run(ctx context.Context, log logging.Logger, _ *advisor.CheckSpec, it any) ([]advisor.CheckReportFailure, error) {
	pi, ok := it.(*pluginItem)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", it)
	}

	p := pi.Plugin
	invalidSignatureTypes := []plugins.SignatureStatus{
		plugins.SignatureStatusUnsigned,
		plugins.SignatureStatusModified,
		plugins.SignatureStatusInvalid,
	}
	if p != nil && slices.Contains(invalidSignatureTypes, p.Signature) {
		// This will only happen in dev mode or if the plugin is in the unsigned allow list
		links := []advisor.CheckErrorLink{}
		if _, ok := s.pluginIndex[p.ID]; ok {
			links = append(links, advisor.CheckErrorLink{
				Message: "View plugin",
				Url:     fmt.Sprintf("/plugins/%s", p.ID),
			})
		}
		return []advisor.CheckReportFailure{checks.NewCheckReportFailure(
			advisor.CheckReportFailureSeverityLow,
			s.ID(),
			p.Name,
			p.ID,
			links,
		)}, nil
	}

	pluginErr := pi.Err
	invalidErrorCodeTypes := []plugins.ErrorCode{
		plugins.ErrorCodeSignatureMissing,
		plugins.ErrorCodeSignatureInvalid,
		plugins.ErrorCodeSignatureModified,
	}
	if pluginErr != nil && slices.Contains(invalidErrorCodeTypes, pluginErr.ErrorCode) {
		links := []advisor.CheckErrorLink{}
		if _, ok := s.pluginIndex[pluginErr.PluginID]; ok {
			links = append(links, advisor.CheckErrorLink{
				Message: "View plugin",
				Url:     fmt.Sprintf("/plugins/%s", pluginErr.PluginID),
			})
		}
		return []advisor.CheckReportFailure{checks.NewCheckReportFailure(
			advisor.CheckReportFailureSeverityHigh,
			s.ID(),
			pluginErr.PluginID,
			pluginErr.PluginID,
			links,
		)}, nil
	}

	return nil, nil
}
