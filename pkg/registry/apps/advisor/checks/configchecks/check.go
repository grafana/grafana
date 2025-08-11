package configchecks

import (
	"context"

	"github.com/grafana/grafana/pkg/registry/apps/advisor/checks"
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
	return []any{"security.secret_key"}, nil
}

func (c *check) Item(ctx context.Context, id string) (any, error) {
	return id, nil
}

func (c *check) Init(ctx context.Context) error {
	return nil
}

func (c *check) Steps() []checks.Step {
	return []checks.Step{
		&securityConfigStep{
			securitySection: c.cfg.SectionWithEnvOverrides("security"),
		},
	}
}
