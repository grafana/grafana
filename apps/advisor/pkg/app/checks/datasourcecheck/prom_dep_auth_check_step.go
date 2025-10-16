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
	return "Check if Prometheus data sources are using deprecated authentication methods (Azure auth and SigV4)"
}

func (s *promDepAuthStep) Resolution() string {
	return "Enable the feature toggle for 'prometheusTypeMigration'. If this feature toggle is already enabled, make sure that 'Azure Monitor Managed Service for Prometheus' and/or 'Amazon Managed Service for Prometheus' plugins are installed."
}

func (s *promDepAuthStep) ID() string {
	return PromDepAuthStepID
}

func (s *promDepAuthStep) Run(ctx context.Context, log logging.Logger, obj *advisor.CheckSpec, item any) ([]advisor.CheckReportFailure, error) {
	dataSource, ok := item.(*datasources.DataSource)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", item)
	}
	if dataSource.Type != datasources.DS_PROMETHEUS {
		return nil, nil
	}
	if dataSource.JsonData == nil {
		return nil, nil
	}

	awsAuthLinks, err := s.checkUsingAWSAuth(ctx, dataSource)
	if err != nil {
		return nil, err
	}
	azureAuthLinks, err := s.checkUsingAzureAuth(ctx, dataSource)
	if err != nil {
		return nil, err
	}

	errorLinks := append(awsAuthLinks, azureAuthLinks...)

	if len(errorLinks) == 0 {
		return nil, nil
	}

	return []advisor.CheckReportFailure{checks.NewCheckReportFailureWithMoreInfo(
		advisor.CheckReportFailureSeverityHigh,
		s.ID(),
		dataSource.Name,
		dataSource.UID,
		errorLinks,
		fmt.Sprintf("Plugin: %s", dataSource.Type),
	)}, nil
}

func (s *promDepAuthStep) checkUsingAWSAuth(ctx context.Context, dataSource *datasources.DataSource) ([]advisor.CheckErrorLink, error) {
	var errorLinks []advisor.CheckErrorLink
	if sigV4Auth, found := dataSource.JsonData.CheckGet("sigV4Auth"); found {
		if enabled, err := sigV4Auth.Bool(); err != nil || !enabled {
			// Disabled or not a valid boolean
			return nil, nil
		}
		readOnlyLink, err := checkReadOnly(dataSource)
		if err != nil {
			return nil, err
		}

		if readOnlyLink != nil {
			errorLinks = append(errorLinks, *readOnlyLink)
		}

		errorLinks = append(errorLinks,
			advisor.CheckErrorLink{
				Message: "View SigV4 docs",
				Url:     "https://grafana.com/docs/grafana-cloud/connect-externally-hosted/data-sources/prometheus/configure/aws-authentication/",
			})
		pluginLink, err := s.linkDataSource(ctx, datasources.DS_AMAZON_PROMETHEUS)
		if err != nil {
			return nil, err
		}
		if pluginLink != nil {
			errorLinks = append(errorLinks, *pluginLink)
		}
	}
	return errorLinks, nil
}

func (s *promDepAuthStep) checkUsingAzureAuth(ctx context.Context, dataSource *datasources.DataSource) ([]advisor.CheckErrorLink, error) {
	var errorLinks []advisor.CheckErrorLink
	if azureAuth, found := dataSource.JsonData.CheckGet("azureCredentials"); found {
		if _, err := azureAuth.Value(); err != nil {
			return nil, err
		}
		readOnlyLink, err := checkReadOnly(dataSource)
		if err != nil {
			return nil, err
		}
		if readOnlyLink != nil {
			errorLinks = append(errorLinks, *readOnlyLink)
		}
		errorLinks = append(errorLinks,
			advisor.CheckErrorLink{
				Message: "View Azure auth docs",
				Url:     "https://grafana.com/docs/grafana-cloud/connect-externally-hosted/data-sources/prometheus/configure/azure-authentication/",
			})
		pluginLink, err := s.linkDataSource(ctx, datasources.DS_AZURE_PROMETHEUS)
		if err != nil {
			return errorLinks, err
		}
		if pluginLink != nil {
			errorLinks = append(errorLinks, *pluginLink)
		}
	}
	return errorLinks, nil
}

func checkReadOnly(dataSource *datasources.DataSource) (*advisor.CheckErrorLink, error) {
	if readOnly, found := dataSource.JsonData.CheckGet("readonly"); found {
		if enabled, err := readOnly.Bool(); err != nil || !enabled {
			return nil, err
		}
		return &advisor.CheckErrorLink{
			Message: "Plugin is ReadOnly",
			Url:     fmt.Sprintf("/plugins/%s", dataSource.Type),
		}, nil
	}
	return nil, nil
}

func (s *promDepAuthStep) linkDataSource(ctx context.Context, pluginType string) (*advisor.CheckErrorLink, error) {
	availablePlugins, err := s.PluginRepo.GetPluginsInfo(ctx, repo.GetPluginsInfoOptions{
		IncludeDeprecated: true,
		Plugins:           []string{pluginType},
	}, repo.NewCompatOpts(s.GrafanaVersion, sysruntime.GOOS, sysruntime.GOARCH))
	if err != nil {
		return nil, err
	}
	if len(availablePlugins) > 0 {
		// Plugin is available in the repo
		return &advisor.CheckErrorLink{
			Message: "View plugin",
			Url:     fmt.Sprintf("/plugins/%s", pluginType),
		}, nil
	}
	return nil, nil
}
