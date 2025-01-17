package app

import (
	"context"
	"fmt"
	sysruntime "runtime"

	"github.com/grafana/grafana-app-sdk/resource"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/common"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

func init() {
	common.RegisterCheck(&pluginCheckRegisterer{})
}

type pluginCheckRegisterer struct{}

func (p *pluginCheckRegisterer) New(cfg *common.AdvisorConfig) common.Check {
	return &PluginCheckImpl{
		pluginStore: cfg.PluginStore,
		pluginRepo:  cfg.PluginRepo,
	}
}

func (p *pluginCheckRegisterer) Kind() resource.Kind {
	return advisor.PluginCheckKind()
}

type PluginCheckImpl struct {
	pluginStore pluginstore.Store
	pluginRepo  repo.Service
}

func (c *PluginCheckImpl) Run(ctx context.Context, obj *common.CheckData) (*common.CheckReport, error) {
	ps := c.pluginStore.Plugins(ctx)

	dsErrs := []common.ReportError{}
	for _, p := range ps {
		// Check if plugin is deprecated
		i, err := c.pluginRepo.PluginInfo(ctx, p.ID)
		if err != nil {
			continue
		}
		if i.Status == "deprecated" {
			dsErrs = append(dsErrs, common.ReportError{
				Type:   common.ReportErrorTypeInvestigation,
				Reason: fmt.Sprintf("Plugin deprecated: %s", p.ID),
				Action: "Look for alternatives",
			})
		}

		// Check if plugin has a newer version
		info, err := c.pluginRepo.GetPluginArchiveInfo(ctx, p.ID, "", repo.NewCompatOpts("", sysruntime.GOOS, sysruntime.GOARCH))
		if err != nil {
			continue
		}
		if info.Version != p.Info.Version { // TODO: Improve check for newer version
			dsErrs = append(dsErrs, common.ReportError{
				Type:   common.ReportErrorTypeAction,
				Reason: fmt.Sprintf("Newer version available: %s", p.ID),
				Action: "Update plugin",
			})
		}
	}

	return &common.CheckReport{
		Count:  int64(len(ps)),
		Errors: dsErrs,
	}, nil
}
