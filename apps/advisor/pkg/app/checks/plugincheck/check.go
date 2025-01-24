package plugincheck

import (
	"context"
	"fmt"
	sysruntime "runtime"

	"github.com/Masterminds/semver/v3"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/services"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

func New(
	pluginStore pluginstore.Store,
	pluginRepo repo.Service,
) checks.Check {
	return &check{
		PluginStore: pluginStore,
		PluginRepo:  pluginRepo,
	}
}

type check struct {
	PluginStore pluginstore.Store
	PluginRepo  repo.Service
}

func (c *check) Type() string {
	return "plugin"
}

func (c *check) Run(ctx context.Context, _ *advisor.CheckSpec) (*advisor.CheckV0alpha1StatusReport, error) {
	ps := c.PluginStore.Plugins(ctx)

	errs := []advisor.CheckV0alpha1StatusReportErrors{}
	for _, p := range ps {
		// Check if plugin is deprecated
		i, err := c.PluginRepo.PluginInfo(ctx, p.ID)
		if err != nil {
			continue
		}
		if i.Status == "deprecated" {
			errs = append(errs, advisor.CheckV0alpha1StatusReportErrors{
				Severity: advisor.CheckStatusSeverityHigh,
				Reason:   fmt.Sprintf("Plugin deprecated: %s", p.ID),
				Action:   "Look for alternatives",
			})
		}

		// Check if plugin has a newer version
		compatOpts := repo.NewCompatOpts(services.GrafanaVersion, sysruntime.GOOS, sysruntime.GOARCH)
		info, err := c.PluginRepo.GetPluginArchiveInfo(ctx, p.ID, "", compatOpts)
		if err != nil {
			continue
		}
		if hasUpdate(p, info) {
			errs = append(errs, advisor.CheckV0alpha1StatusReportErrors{
				Severity: advisor.CheckStatusSeverityLow,
				Reason:   fmt.Sprintf("New version available: %s", p.ID),
				Action:   "Update plugin",
			})
		}
	}

	return &advisor.CheckV0alpha1StatusReport{
		Count:  int64(len(ps)),
		Errors: errs,
	}, nil
}

func hasUpdate(current pluginstore.Plugin, latest *repo.PluginArchiveInfo) bool {
	// If both versions are semver-valid, compare them
	v1, err1 := semver.NewVersion(current.Info.Version)
	v2, err2 := semver.NewVersion(latest.Version)
	if err1 == nil && err2 == nil {
		return v1.LessThan(v2)
	}
	// In other case, assume that a different latest version will always be newer
	return current.Info.Version != latest.Version
}
