package datasourcecheck

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type promDepAuthStep struct {
	IsPluginInstalledOrAvailableFunc func(ctx context.Context, pluginType string) (bool, error)
}

func (s *promDepAuthStep) Title() string {
	return "Prometheus deprecated authentication check"
}

func (s *promDepAuthStep) Description() string {
	return "Check if Prometheus data sources are using deprecated authentication methods (Azure auth and SigV4)"
}

func (s *promDepAuthStep) Resolution() string {
	return fmt.Sprintf("Enable the feature toggle for 'prometheusTypeMigration'. If this feature toggle is already enabled, make sure that 'Azure Monitor Managed Service for Prometheus' and/or 'Amazon Managed Service for Prometheus' plugins are installed. If the data source is provisioned, edit data source type in the provisioning file to use '%s' or '%s'.", datasources.DS_AMAZON_PROMETHEUS, datasources.DS_AZURE_PROMETHEUS)
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
		fmt.Sprintf("Datasource %s (UID: %s) is of type %s but it's using a deprecated authentication method so it should be migrated", dataSource.Name, dataSource.UID, dataSource.Type),
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
		pluginLink, err := s.linkDataSource(ctx, datasources.DS_AMAZON_PROMETHEUS, "Amazon Managed Service for Prometheus")
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
			// azureAuth does not have a value
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
				Message: "View Azure auth docs",
				Url:     "https://grafana.com/docs/grafana-cloud/connect-externally-hosted/data-sources/prometheus/configure/azure-authentication/",
			})
		pluginLink, err := s.linkDataSource(ctx, datasources.DS_AZURE_PROMETHEUS, "Azure Monitor Managed Service for Prometheus")
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
			// Disabled or not a valid boolean
			return nil, nil
		}
		return &advisor.CheckErrorLink{
			Message: "Change provisioning file",
			Url:     "https://grafana.com/docs/grafana/latest/administration/provisioning/#data-sources",
		}, nil
	}
	return nil, nil
}

func (s *promDepAuthStep) linkDataSource(ctx context.Context, pluginType string, pluginName string) (*advisor.CheckErrorLink, error) {
	isPluginAvailable, err := s.IsPluginInstalledOrAvailableFunc(ctx, pluginType)
	if err != nil {
		return nil, nil
	}
	if !isPluginAvailable {
		// Plugin is available in the repo
		return &advisor.CheckErrorLink{
			Message: fmt.Sprintf("Install %s", pluginName),
			Url:     fmt.Sprintf("/plugins/%s", pluginType),
		}, nil
	}
	return nil, nil
}
