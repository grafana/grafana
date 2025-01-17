package app

import (
	"context"
	"fmt"
	sysruntime "runtime"

	"github.com/grafana/grafana-app-sdk/resource"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

func init() {
	registerChecks = append(registerChecks, &pluginCheckRegisterer{})
}

type pluginCheckRegisterer struct{}

func (p *pluginCheckRegisterer) New(cfg *AdvisorConfig) check {
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

func (c *PluginCheckImpl) Run(ctx context.Context, obj resource.Object) (resource.Object, error) {
	ps := c.pluginStore.Plugins(ctx)

	dsErrs := []advisor.PluginCheckV0alpha1StatusReportErrors{}
	for _, p := range ps {
		// Check if plugin is deprecated
		i, err := c.pluginRepo.PluginInfo(ctx, p.ID)
		if err != nil {
			continue
		}
		if i.Status == "deprecated" {
			dsErrs = append(dsErrs, advisor.PluginCheckV0alpha1StatusReportErrors{
				Type:   advisor.PluginCheckStatusTypeInvestigation,
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
			dsErrs = append(dsErrs, advisor.PluginCheckV0alpha1StatusReportErrors{
				Type:   advisor.PluginCheckStatusTypeAction,
				Reason: fmt.Sprintf("Newer version available: %s", p.ID),
				Action: "Update plugin",
			})
		}
	}

	// Store result in the object
	d, ok := obj.(*advisor.PluginCheck)
	if !ok {
		return nil, fmt.Errorf("invalid object type")
	}
	d.PluginCheckStatus = advisor.PluginCheckStatus{
		Report: advisor.PluginCheckV0alpha1StatusReport{
			Count:  int64(len(ps)),
			Errors: dsErrs,
		},
	}
	return d, nil
}
