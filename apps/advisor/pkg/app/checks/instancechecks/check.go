package instancechecks

import (
	"context"
	"time"

	"github.com/google/go-github/v70/github"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/setting"
)

var _ checks.Check = (*check)(nil)

type check struct {
	cfg             *setting.Cfg
	isCloudInstance bool
}

func New(cfg *setting.Cfg) checks.Check {
	return &check{
		cfg:             cfg,
		isCloudInstance: cfg.StackID != "",
	}
}

func (c *check) ID() string {
	return "instance"
}

func (c *check) Name() string {
	return "instance attribute"
}

func (c *check) Items(ctx context.Context) ([]any, error) {
	if c.isCloudInstance {
		return []any{
			pinnedVersion, // pinned version check
		}, nil
	}

	return []any{
		outOfSupportVersion, // out of support version check
	}, nil
}

func (c *check) Item(ctx context.Context, id string) (any, error) {
	return id, nil
}

func (c *check) Init(ctx context.Context) error {
	return nil
}

func (c *check) Steps() []checks.Step {
	// If running in cloud, we need to check if the version is pinned
	if c.isCloudInstance {
		return []checks.Step{
			&pinnedVersionStep{
				BuildBranch: c.cfg.BuildBranch,
			},
		}
	}

	// If running in self-managed, we need to check if the version is out of support
	return []checks.Step{
		&outOfSupportVersionStep{
			GrafanaVersion: c.cfg.BuildVersion,
			BuildDate:      time.Unix(c.cfg.BuildStamp, 0).UTC(),
			ghClient:       github.NewClient(nil).Repositories,
		},
	}
}
