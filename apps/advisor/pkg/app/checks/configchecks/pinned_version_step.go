package configchecks

import (
	"context"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/setting"
)

var _ checks.Step = &pinnedVersionStep{}

type pinnedVersionStep struct {
	StackID        string
	GrafanaVersion string
	cfg            *setting.Cfg
}

func (s *pinnedVersionStep) Title() string {
	return "Pinned version"
}

func (s *pinnedVersionStep) Description() string {
	return "Check if the Grafana version is pinned."
}

func (s *pinnedVersionStep) Resolution() string {
	return "Contact your Grafana administrator to unpin the Grafana version."
}

func (s *pinnedVersionStep) ID() string {
	return "pinned_version"
}

func (s *pinnedVersionStep) Run(ctx context.Context, log logging.Logger, _ *advisor.CheckSpec, it any) ([]advisor.CheckReportFailure, error) {
	if s.StackID == "" {
		// Not running in cloud
		return nil, nil
	}

	log.Info("Pinned version ? ",
		"stackID", s.StackID,
		"grafana version", s.cfg.BuildVersion,
		"build commit", s.cfg.BuildCommit,
		"enterprise build commit", s.cfg.EnterpriseBuildCommit,
		"build branch", s.cfg.BuildBranch,
		"build stamp", s.cfg.BuildStamp)

	return nil, nil
}
