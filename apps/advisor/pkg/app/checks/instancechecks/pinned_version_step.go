package instancechecks

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
)

var _ checks.Step = &pinnedVersionStep{}

const (
	pinnedVersion = "pinned_version"
)

type pinnedVersionStep struct {
	BuildBranch string
}

func (s *pinnedVersionStep) Title() string {
	return "Grafana Cloud version check"
}

func (s *pinnedVersionStep) Description() string {
	return "Checks if the Grafana version is pinned."
}

func (s *pinnedVersionStep) Resolution() string {
	return "You may miss out on security updates and bug fixes if you use a pinned version. " +
		"Contact your Grafana administrator and open a <support>support ticket</support> to help you get unpinned."
}

func (s *pinnedVersionStep) ResolutionLinks() map[string]string {
	return map[string]string{
		"support": "https://grafana.com/profile/org#support",
	}
}

func (s *pinnedVersionStep) ID() string {
	return pinnedVersion
}

func (s *pinnedVersionStep) Run(ctx context.Context, log logging.Logger, _ *advisor.CheckSpec, it any) ([]advisor.CheckReportFailure, error) {
	item, ok := it.(string)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", it)
	}
	if item != pinnedVersion {
		// Not interested in this item
		return nil, nil
	}

	if s.BuildBranch == "HEAD" {
		// Not a pinned version
		return nil, nil
	}

	return []advisor.CheckReportFailure{checks.NewCheckReportFailure(
		advisor.CheckReportFailureSeverityLow,
		s.ID(),
		"Grafana version is pinned",
		"pinned_version",
		[]advisor.CheckErrorLink{},
	)}, nil
}
