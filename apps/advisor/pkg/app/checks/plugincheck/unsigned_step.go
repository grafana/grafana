package plugincheck

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

const (
	UnsignedStepID = "unsigned"
)

type unsignedStep struct {
}

func (s *unsignedStep) Title() string {
	return "Plugin signature check"
}

func (s *unsignedStep) Description() string {
	return "Checks has a missing or invalid signature."
}

func (s *unsignedStep) Resolution() string {
	return "Delete the plugin and install it from the Grafana plugin catalog."
}

func (s *unsignedStep) ID() string {
	return UnsignedStepID
}

func (s *unsignedStep) Run(ctx context.Context, log logging.Logger, _ *advisor.CheckSpec, i any) ([]advisor.CheckReportFailure, error) {
	p, ok := i.(pluginstore.Plugin)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", i)
	}

	if p.Signature == plugins.SignatureStatusUnsigned ||
		p.Signature == plugins.SignatureStatusModified ||
		p.Signature == plugins.SignatureStatusInvalid {
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
