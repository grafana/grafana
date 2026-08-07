package configchecks

import (
	"context"

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
	items := []any{"security.secret_key"}
	if c.annotationsAppPlatformEnabled() {
		items = append(items, annotationsRetentionTTLItem)
	}
	return items, nil
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
	// Only register the annotations step when the App Platform annotations API is
	// enabled, otherwise it would show up as an empty "no action needed" entry.
	if c.annotationsAppPlatformEnabled() {
		steps = append(steps, &annotationsConfigStep{
			appPlatformSection: c.cfg.SectionWithEnvOverrides("annotations.app_platform"),
		})
	}
	return steps
}

func (c *check) annotationsAppPlatformEnabled() bool {
	return c.cfg.SectionWithEnvOverrides("annotations.app_platform").Key("enabled").MustBool(false)
}
