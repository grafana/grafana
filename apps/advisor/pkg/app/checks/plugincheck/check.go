package plugincheck

import (
	"context"
	sysruntime "runtime"

	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginchecker"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

const (
	CheckID = "plugin"
)

func New(
	pluginStore pluginstore.Store,
	pluginRepo repo.Service,
	updateChecker pluginchecker.PluginUpdateChecker,
	grafanaVersion string,
) checks.Check {
	return &check{
		PluginStore:    pluginStore,
		PluginRepo:     pluginRepo,
		GrafanaVersion: grafanaVersion,
		updateChecker:  updateChecker,
	}
}

type check struct {
	PluginStore    pluginstore.Store
	PluginRepo     repo.Service
	updateChecker  pluginchecker.PluginUpdateChecker
	GrafanaVersion string
	pluginIndex    map[string]repo.PluginInfo
}

func (c *check) ID() string {
	return CheckID
}

func (c *check) Name() string {
	return "plugin"
}

func (c *check) Items(ctx context.Context) ([]any, error) {
	ps := c.PluginStore.Plugins(ctx)
	res := make([]any, len(ps))
	for i, p := range ps {
		res[i] = p
	}
	return res, nil
}

func (c *check) Item(ctx context.Context, id string) (any, error) {
	p, exists := c.PluginStore.Plugin(ctx, id)
	if !exists {
		return nil, nil
	}
	return p, nil
}

func (c *check) Init(ctx context.Context) error {
	compatOpts := repo.NewCompatOpts(c.GrafanaVersion, sysruntime.GOOS, sysruntime.GOARCH)
	ps := c.PluginStore.Plugins(ctx)
	pluginIDs := make([]string, len(ps))
	for i, p := range ps {
		pluginIDs[i] = p.ID
	}
	plugins, err := c.PluginRepo.GetPluginsInfo(ctx, repo.GetPluginsInfoOptions{
		IncludeDeprecated: true,
		Plugins:           pluginIDs,
	}, compatOpts)
	if err != nil {
		return err
	}
	c.pluginIndex = make(map[string]repo.PluginInfo)
	for _, p := range plugins {
		c.pluginIndex[p.Slug] = p
	}
	return nil
}

func (c *check) Steps() []checks.Step {
	return []checks.Step{
		&deprecationStep{
			GrafanaVersion: c.GrafanaVersion,
			updateChecker:  c.updateChecker,
			pluginIndex:    c.pluginIndex,
		},
		&updateStep{
			GrafanaVersion: c.GrafanaVersion,
			updateChecker:  c.updateChecker,
			pluginIndex:    c.pluginIndex,
		},
		&unsignedStep{},
	}
}
