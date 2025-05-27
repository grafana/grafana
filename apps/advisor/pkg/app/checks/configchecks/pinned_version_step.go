package configchecks

import (
	"context"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
)

var _ checks.Step = &pinnedVersionStep{}

type pinnedVersionStep struct {
	StackID     string
	BuildBranch string
}

func (s *pinnedVersionStep) Title() string {
	return "Pinned version"
}

func (s *pinnedVersionStep) Description() string {
	return "Check if the Grafana version is pinned."
}

func (s *pinnedVersionStep) Resolution() string {
	return "You may miss out on security updates and bug fixes if you use a pinned version. Contact your Grafana administrator."
}

func (s *pinnedVersionStep) ID() string {
	return "pinned_version"
}

func (s *pinnedVersionStep) Run(ctx context.Context, log logging.Logger, _ *advisor.CheckSpec, it any) ([]advisor.CheckReportFailure, error) {
	if s.StackID == "" || s.BuildBranch == "HEAD" {
		// Not running in cloud or not a pinned version
		// Pinned versions have a custom build branch name
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
