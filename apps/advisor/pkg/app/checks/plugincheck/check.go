package plugincheck

import (
	"context"
	sysruntime "runtime"

	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/plugins"
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
	pluginErrorResolver plugins.ErrorResolver,
	grafanaVersion string,
) checks.Check {
	return &check{
		PluginStore:         pluginStore,
		PluginRepo:          pluginRepo,
		GrafanaVersion:      grafanaVersion,
		updateChecker:       updateChecker,
		pluginErrorResolver: pluginErrorResolver,
	}
}

type check struct {
	PluginStore         pluginstore.Store
	PluginRepo          repo.Service
	updateChecker       pluginchecker.PluginUpdateChecker
	pluginErrorResolver plugins.ErrorResolver
	GrafanaVersion      string
	pluginIndex         map[string]repo.PluginInfo
}

func (c *check) ID() string {
	return CheckID
}

func (c *check) Name() string {
	return "plugin"
}

type pluginItem struct {
	Plugin *pluginstore.Plugin
	Err    *plugins.Error
}

func (c *check) Items(ctx context.Context) ([]any, error) {
	ps := c.PluginStore.Plugins(ctx)
	resMap := map[string]*pluginItem{}
	for _, p := range ps {
		resMap[p.ID] = &pluginItem{
			Plugin: &p,
			Err:    c.pluginErrorResolver.PluginError(ctx, p.ID),
		}
	}

	// Plugins with errors are not added to the plugin store but
	// we still want to show them in the check results so we add them to the map
	pluginErrors := c.pluginErrorResolver.PluginErrors(ctx)
	for _, e := range pluginErrors {
		if _, exists := resMap[e.PluginID]; exists {
			resMap[e.PluginID].Err = e
		} else {
			resMap[e.PluginID] = &pluginItem{
				Plugin: nil,
				Err:    e,
			}
		}
	}

	res := make([]any, 0, len(resMap))
	for _, p := range resMap {
		res = append(res, p)
	}

	return res, nil
}

func (c *check) Item(ctx context.Context, id string) (any, error) {
	p, exists := c.PluginStore.Plugin(ctx, id)
	if !exists {
		return nil, nil
	}
	return &pluginItem{
		Plugin: &p,
		Err:    c.pluginErrorResolver.PluginError(ctx, p.ID),
	}, nil
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
		&unsignedStep{
			pluginIndex: c.pluginIndex,
		},
	}
}
