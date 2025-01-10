package plugincheck

import (
	"context"
	"fmt"
	sysruntime "runtime"

	advisor "github.com/grafana/grafana/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/registry/apis/advisor/models"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"k8s.io/apimachinery/pkg/runtime"
)

type PluginCheckImpl struct {
	pluginStore pluginstore.Store
	pluginRepo  repo.Service
}

func New(apiBuilderSvcs *models.AdvisorAPIServices) models.Check {
	return &PluginCheckImpl{
		pluginStore: apiBuilderSvcs.PluginStore,
		pluginRepo:  apiBuilderSvcs.PluginRepo,
	}
}

func (c *PluginCheckImpl) Object() runtime.Object {
	return &advisor.PluginCheck{}
}

func (c *PluginCheckImpl) ObjectList() runtime.Object {
	return &advisor.PluginCheckList{}
}

func (c *PluginCheckImpl) Name() string {
	return "plugincheck"
}

func (c *PluginCheckImpl) Kind() string {
	return "PluginCheck"
}

func (c *PluginCheckImpl) Run(ctx context.Context, obj runtime.Object) (*advisor.CheckStatus, error) {
	ps := c.pluginStore.Plugins(ctx)

	dsErrs := []advisor.CheckError{}
	for _, p := range ps {
		// Check if plugin is deprecated
		i, err := c.pluginRepo.PluginInfo(ctx, p.ID)
		if err != nil {
			continue
		}
		if i.Status == "deprecated" {
			dsErrs = append(dsErrs, advisor.CheckError{
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
			dsErrs = append(dsErrs, advisor.CheckError{
				Type:   "Action recommended",
				Reason: fmt.Sprintf("Newer version available: %s", p.ID),
				Action: "Update plugin",
			})
		}
	}

	return &advisor.CheckStatus{
		Errors: dsErrs,
		Count:  len(ps),
	}, nil
}
