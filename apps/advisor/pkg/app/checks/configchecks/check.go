package configchecks

import (
	"context"
	"time"

	"github.com/google/go-github/v70/github"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/setting"
)

var _ checks.Check = (*check)(nil)

type check struct {
	cfg *setting.Cfg
}

func New(cfg *setting.Cfg) checks.Check {
	return &check{
		cfg: cfg,
	}
}

func (c *check) ID() string {
	return "config"
}

func (c *check) Name() string {
	return "config setting"
}

func (c *check) Items(ctx context.Context) ([]any, error) {
	return []any{
		"security.secret_key", // security config check
		pinnedVersion,         // pinned version check
		outOfSupportVersion,   // out of support version check
	}, nil
}

func (c *check) Item(ctx context.Context, id string) (any, error) {
	return id, nil
}

func (c *check) Init(ctx context.Context) error {
	return nil
}

func (c *check) Steps() []checks.Step {
	steps := []checks.Step{
		&securityConfigStep{
			securitySection: c.cfg.SectionWithEnvOverrides("security"),
		},
	}

	// If running in cloud, we need to check if the version is pinned
	if c.cfg.StackID != "" {
		steps = append(steps, &pinnedVersionStep{
			StackID:     c.cfg.StackID,
			BuildBranch: c.cfg.BuildBranch,
		})
	} else {
		// If running in self-managed, we need to check if the version is out of support
		steps = append(steps, &outOfSupportVersionStep{
			StackID:        c.cfg.StackID,
			GrafanaVersion: c.cfg.BuildVersion,
			BuildDate:      time.Unix(c.cfg.BuildStamp, 0).UTC(),
			ghClient:       github.NewClient(nil).Repositories,
		})
	}

	return steps
}
