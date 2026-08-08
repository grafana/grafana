package datasourcecheck

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/apps/advisor/translations"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type promDepAuthStep struct {
	canBeInstalled func(ctx context.Context, pluginType string) (bool, error)
}

func (s *promDepAuthStep) Title() string {
	return translations.StepTitle(CheckID, PromDepAuthStepID)
}

func (s *promDepAuthStep) Description() string {
	return translations.StepDescription(CheckID, PromDepAuthStepID)
}

func (s *promDepAuthStep) Resolution() string {
	return translations.StepResolution(CheckID, PromDepAuthStepID)
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
		readOnlyLink := checkReadOnly(dataSource)

		if readOnlyLink != nil {
			errorLinks = append(errorLinks, *readOnlyLink)
		}

		errorLinks = append(errorLinks,
			advisor.CheckErrorLink{
				Message: translations.LinkMessage("view-sigv4-docs"),
				Url:     "https://grafana.com/docs/grafana-cloud/connect-externally-hosted/data-sources/prometheus/configure/aws-authentication/",
			})
		pluginLink := s.linkDataSource(ctx, datasources.DS_AMAZON_PROMETHEUS, translations.LinkMessage("install-amazon-managed-service-for-prometheus"))
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
		readOnlyLink := checkReadOnly(dataSource)
		if readOnlyLink != nil {
			errorLinks = append(errorLinks, *readOnlyLink)
		}
		errorLinks = append(errorLinks,
			advisor.CheckErrorLink{
				Message: translations.LinkMessage("view-azure-auth-docs"),
				Url:     "https://grafana.com/docs/grafana-cloud/connect-externally-hosted/data-sources/prometheus/configure/azure-authentication/",
			})
		pluginLink := s.linkDataSource(ctx, datasources.DS_AZURE_PROMETHEUS, translations.LinkMessage("install-azure-monitor-managed-service-for-prometheus"))
		if pluginLink != nil {
			errorLinks = append(errorLinks, *pluginLink)
		}
	}
	return errorLinks, nil
}

func checkReadOnly(dataSource *datasources.DataSource) *advisor.CheckErrorLink {
	if readOnly, found := dataSource.JsonData.CheckGet("readonly"); found {
		if enabled, err := readOnly.Bool(); err != nil || !enabled {
			// Disabled or not a valid boolean
			return nil
		}
		return &advisor.CheckErrorLink{
			Message: translations.LinkMessage("change-provisioning-file"),
			Url:     "https://grafana.com/docs/grafana/latest/administration/provisioning/#data-sources",
		}
	}
	return nil
}

func (s *promDepAuthStep) linkDataSource(ctx context.Context, pluginType string, message string) *advisor.CheckErrorLink {
	canBeInstalled, err := s.canBeInstalled(ctx, pluginType)
	if err != nil {
		return nil
	}
	if canBeInstalled {
		// Plugin is available in the repo
		return &advisor.CheckErrorLink{
			Message: message,
			Url:     fmt.Sprintf("/plugins/%s", pluginType),
		}
	}
	return nil
}
