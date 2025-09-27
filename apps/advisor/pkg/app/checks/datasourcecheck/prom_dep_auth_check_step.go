package datasourcecheck

import (
	"context"
	"fmt"
	sysruntime "runtime"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type promDepAuthStep struct {
	PluginRepo     repo.Service
	GrafanaVersion string
}

func (s *promDepAuthStep) Title() string {
	return "Prometheus deprecated authentication check"
}

func (s *promDepAuthStep) Description() string {
	return "Check if Prometheus data sources are using deprecated authentication methods (Azure and AWS)"
}

func (s *promDepAuthStep) Resolution() string {
	return "Enable the feature flag for 'prometheusTypeMigration'. If the feature flag is enabled and the migration is failing, make sure to install 'Azure Monitor Managed Service for Prometheus' and/or 'Amazon Managed Service for Prometheus'."
}

func (s *promDepAuthStep) ID() string {
	return PromDepAuthStepID
}

func (s *promDepAuthStep) Run(ctx context.Context, log logging.Logger, obj *advisor.CheckSpec, i any) ([]advisor.CheckReportFailure, error) {
	ds, ok := i.(*datasources.DataSource)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", i)
	}
	if ds.Type != datasources.DS_PROMETHEUS {
		return nil, nil
	}

	links := []advisor.CheckErrorLink{}

	awsLink, err := s.checkUsingAWSAuth(ctx, ds)
	if err != nil {
		return nil, err
	}
	if awsLink != nil {
		links = append(links, *awsLink)
	}

	azureLink, err := s.checkUsingAzureAuth(ctx, ds)
	if err != nil {
		return nil, err
	}
	if azureLink != nil {
		links = append(links, *azureLink)
	}

	if awsLink == nil && azureLink == nil {
		return nil, nil
	}

	return []advisor.CheckReportFailure{checks.NewCheckReportFailureWithMoreInfo(
		advisor.CheckReportFailureSeverityHigh,
		s.ID(),
		ds.Name,
		ds.UID,
		links,
		fmt.Sprintf("Plugin: %s", ds.Type),
	)}, nil

}

func (s *promDepAuthStep) checkUsingAWSAuth(ctx context.Context, ds *datasources.DataSource) (*advisor.CheckErrorLink, error) {
	if sigV4Auth, found := ds.JsonData.CheckGet("sigV4Auth"); found {
		if enabled, err := sigV4Auth.Bool(); err != nil || !enabled {
			return nil, err
		}
		ro, err := checkReadOnly(ds)
		if err != nil || ro != nil {
			return ro, err
		}
		return s.linkDataSource(ctx, datasources.DS_AMAZON_PROMETHEUS)
	}
	return nil, nil
}

func (s *promDepAuthStep) checkUsingAzureAuth(ctx context.Context, ds *datasources.DataSource) (*advisor.CheckErrorLink, error) {
	if azureAuth, found := ds.JsonData.CheckGet("azureCredentials"); found {
		if val, err := azureAuth.Value(); err != nil || val == nil {
			return nil, err
		}
		ro, err := checkReadOnly(ds)
		if err != nil || ro != nil {
			return ro, err
		}
		return s.linkDataSource(ctx, datasources.DS_AZURE_PROMETHEUS)
	}
	return nil, nil
}

func checkReadOnly(ds *datasources.DataSource) (*advisor.CheckErrorLink, error) {
	if readOnly, found := ds.JsonData.CheckGet("readonly"); found {
		if enabled, err := readOnly.Bool(); err != nil || !enabled {
			return nil, err
		}
		return &advisor.CheckErrorLink{
			Message: "Plugin is ReadOnly",
			Url:     fmt.Sprintf("/plugins/%s", ds.Type),
		}, nil
	}
	return nil, nil
}

func (s *promDepAuthStep) linkDataSource(ctx context.Context, dataSourceType string) (*advisor.CheckErrorLink, error) {
	plugins, err := s.PluginRepo.GetPluginsInfo(ctx, repo.GetPluginsInfoOptions{
		IncludeDeprecated: true,
		Plugins:           []string{dataSourceType},
	}, repo.NewCompatOpts(s.GrafanaVersion, sysruntime.GOOS, sysruntime.GOARCH))
	if err != nil {
		return nil, err
	}
	if len(plugins) > 0 {
		// Plugin is available in the repo
		return &advisor.CheckErrorLink{
			Message: "View plugin",
			Url:     fmt.Sprintf("/plugins/%s", dataSourceType),
		}, nil
	}
	return nil, nil
}
