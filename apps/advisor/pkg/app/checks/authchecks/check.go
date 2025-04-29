package authchecks

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ssosettings"
)

const (
	CheckID                                = "ssosetting"
	AllowedOrgsFormatValidationStepID      = "allowed-organizations-format-validation"
	AllowedGroupsFormatValidationStepID    = "allowed-groups-format-validation"
	AllowedDomainsFormatValidationStepID   = "allowed-domains-format-validation"
	RoleValuesGrafanaAdminValidationStepID = "role-values-grafana-admin-validation"
	RoleValuesAdminFormatValidationStepID  = "role-values-admin-format-validation"
	RoleValuesEditorFormatValidationStepID = "role-values-editor-format-validation"
	RoleValuesViewerFormatValidationStepID = "role-values-viewer-format-validation"
	RoleValuesNoneFormatValidationStepID   = "role-values-none-format-validation"
)

var _ checks.Check = (*check)(nil)

type check struct {
	ssoSettingsService ssosettings.Service
	log                log.Logger
}

func New(ssoSettingsService ssosettings.Service) checks.Check {
	return &check{
		ssoSettingsService: ssoSettingsService,
		log:                log.New("advisor.ssosettingcheck"),
	}
}

func (c *check) ID() string {
	return CheckID
}

func (c *check) Steps() []checks.Step {
	return []checks.Step{
		NewListFormatValidation(AllowedDomainsFormatValidationStepID, "allowed_domains", "Allowed Domains format validation"),
		NewListFormatValidation(AllowedGroupsFormatValidationStepID, "allowed_groups", "Allowed Groups format validation"),
		NewListFormatValidation(AllowedOrgsFormatValidationStepID, "allowed_organizations", "Allowed Organizations format validation"),
		NewListFormatValidation(RoleValuesNoneFormatValidationStepID, "role_values_none", "None role values format validation"),
		NewListFormatValidation(RoleValuesGrafanaAdminValidationStepID, "role_values_grafana_admin", "Grafana Admin role values format validation"),
		NewListFormatValidation(RoleValuesAdminFormatValidationStepID, "role_values_admin", "Admin role values format validation"),
		NewListFormatValidation(RoleValuesEditorFormatValidationStepID, "role_values_editor", "Editor role values format validation"),
		NewListFormatValidation(RoleValuesViewerFormatValidationStepID, "role_values_viewer", "Viewer role values format validation"),
		NewListFormatValidation(RoleValuesNoneFormatValidationStepID, "role_values_none", "None role values format validation"),
	}
}

func (c *check) Items(ctx context.Context) ([]any, error) {
	ssoSettings, err := c.ssoSettingsService.ListWithRedactedSecrets(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list SSO settings: %w", err)
	}
	res := make([]any, len(ssoSettings))
	for i, ds := range ssoSettings {
		res[i] = ds
	}
	return res, nil
}

func (c *check) Item(ctx context.Context, id string) (any, error) {
	ssoSetting, err := c.ssoSettingsService.GetForProviderWithRedactedSecrets(ctx, id)
	if err != nil {
		return nil, err
	}
	return ssoSetting, nil
}
