package datasourcecheck

import (
	"context"
	"fmt"
	sysruntime "runtime"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/registry/apps/advisor/checks"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

type missingPluginStep struct {
	PluginStore    pluginstore.Store
	PluginRepo     repo.Service
	GrafanaVersion string
}

func (s *missingPluginStep) Title() string {
	return "Missing plugin check"
}

func (s *missingPluginStep) Description() string {
	return "Checks if the plugin associated with the data source is installed and available."
}

func (s *missingPluginStep) Resolution() string {
	return "Delete the datasource or install the plugin."
}

func (s *missingPluginStep) ID() string {
	return MissingPluginStepID
}

func (s *missingPluginStep) Run(ctx context.Context, log logging.Logger, obj *advisor.CheckSpec, i any) ([]advisor.CheckReportFailure, error) {
	ds, ok := i.(*datasources.DataSource)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", i)
	}

	_, exists := s.PluginStore.Plugin(ctx, ds.Type)
	if !exists {
		links := []advisor.CheckErrorLink{
			{
				Message: "Delete data source",
				Url:     fmt.Sprintf("/connections/datasources/edit/%s", ds.UID),
			},
		}
		plugins, err := s.PluginRepo.GetPluginsInfo(ctx, repo.GetPluginsInfoOptions{
			IncludeDeprecated: true,
			Plugins:           []string{ds.Type},
		}, repo.NewCompatOpts(s.GrafanaVersion, sysruntime.GOOS, sysruntime.GOARCH))
		if err != nil {
			return nil, err
		}
		if len(plugins) > 0 {
			// Plugin is available in the repo
			links = append(links, advisor.CheckErrorLink{
				Message: "View plugin",
				Url:     fmt.Sprintf("/plugins/%s", ds.Type),
			})
		}
		// The plugin is not installed
		return []advisor.CheckReportFailure{checks.NewCheckReportFailureWithMoreInfo(
			advisor.CheckReportFailureSeverityHigh,
			s.ID(),
			ds.Name,
			ds.UID,
			links,
			fmt.Sprintf("Plugin: %s", ds.Type),
		)}, nil
	}
	return nil, nil
}
