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

func NewPluginCheck(cfg *AdvisorConfig) Check {
	return &PluginCheckImpl{
		pluginStore: cfg.PluginStore,
		pluginRepo:  cfg.PluginRepo,
	}
}

func init() {
	registerChecks = append(registerChecks, NewPluginCheck)
}

type PluginCheckImpl struct {
	pluginStore pluginstore.Store
	pluginRepo  repo.Service
}

func (c *PluginCheckImpl) Run(ctx context.Context, obj resource.Object) (*CheckStatus, error) {
	ps := c.pluginStore.Plugins(ctx)

	dsErrs := []CheckError{}
	for _, p := range ps {
		// Check if plugin is deprecated
		i, err := c.pluginRepo.PluginInfo(ctx, p.ID)
		if err != nil {
			continue
		}
		if i.Status == "deprecated" {
			dsErrs = append(dsErrs, CheckError{
				Type:   "Investigation recommended",
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
			dsErrs = append(dsErrs, CheckError{
				Type:   "Action recommended",
				Reason: fmt.Sprintf("Newer version available: %s", p.ID),
				Action: "Update plugin",
			})
		}
	}

	return &CheckStatus{
		Errors: dsErrs,
		Count:  len(ps),
	}, nil
}

func (c *PluginCheckImpl) Updated(ctx context.Context, obj resource.Object) (bool, error) {
	// Optionally read the check input encoded in the object
	d, ok := obj.(*advisor.PluginCheck)
	if !ok {
		return false, fmt.Errorf("invalid object type")
	}
	if d.PluginCheckStatus.AdditionalFields != nil {
		// Already processed
		return true, nil
	}
	return false, nil
}

func (c *PluginCheckImpl) Kind() resource.Kind {
	return advisor.PluginCheckKind()
}
