package authchecks

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/util"
)

const ListFormatValidationStepID = "sso-list-format-validation"

// listSettingKeys defines the SSO setting keys that expect a list format (space-separated, comma-separated or JSON array).
var listSettingKeys = []string{
	"allowed_domains",
	"allowed_groups",
	"allowed_organizations",
	"role_values_none",
	"role_values_grafana_admin",
	"role_values_admin",
	"role_values_editor",
	"role_values_viewer",
}

var _ checks.Step = (*listFormatValidation)(nil)

// listFormatValidation checks if the specified list parameters in SSO settings are in a valid format.
type listFormatValidation struct{}

func (s *listFormatValidation) ID() string {
	return ListFormatValidationStepID
}

func (s *listFormatValidation) Title() string {
	return "SSO List Setting Format Validation"
}

func (s *listFormatValidation) Description() string {
	return "Checks if list configs in SSO settings are in a valid list format (space-separated, comma-separated or JSON array)."
}

func (s *listFormatValidation) Resolution() string {
	return "Configure the relevant SSO setting using a valid format, like space-separated (\"opt1 opt2\"), comma-separated values (\"opt1, opt2\") or JSON array format ([\"opt1\", \"opt2\"])."
}

func (s *listFormatValidation) Run(ctx context.Context, log logging.Logger, _ *advisor.CheckSpec, objToCheck any) ([]advisor.CheckReportFailure, error) {
	setting, ok := objToCheck.(*models.SSOSettings)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", objToCheck)
	}

	reportIssues := make([]advisor.CheckReportFailure, 0, 3)

	for _, settingKey := range listSettingKeys {
		currentSettingValue, exists := setting.Settings[settingKey]
		if !exists || currentSettingValue == nil {
			// If the setting is not present or nil, its format is considered valid (or non-applicable).
			continue
		}

		currentSettingStr, ok := currentSettingValue.(string)
		if !ok {
			reportIssues = append(reportIssues, checks.NewCheckReportFailure(
				advisor.CheckReportFailureSeverityHigh,
				s.ID(),
				fmt.Sprintf("%s - Invalid type for '%s': expected string, got %T", login.GetAuthProviderLabel(setting.Provider), settingKey, currentSettingValue),
				setting.Provider,
				s.generateLinks(setting.Provider),
			))
		}

		if currentSettingStr == "" {
			continue
		}

		_, err := util.SplitStringWithError(currentSettingStr)
		if err != nil {
			reportIssues = append(reportIssues, checks.NewCheckReportFailure(
				advisor.CheckReportFailureSeverityHigh,
				s.ID(),
				fmt.Sprintf("%s - Invalid format for '%s': %s", login.GetAuthProviderLabel(setting.Provider), settingKey, currentSettingStr),
				setting.Provider,
				s.generateLinks(setting.Provider),
			))
		}
	}

	return reportIssues, nil
}

func (s *listFormatValidation) generateLinks(provider string) []advisor.CheckErrorLink {
	return []advisor.CheckErrorLink{
		{
			Url:     fmt.Sprintf("https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/%s", strings.ReplaceAll(provider, "_", "-")),
			Message: "Check the documentation",
		},
		{
			Url:     fmt.Sprintf("/admin/authentication/%s", provider),
			Message: "Configure provider",
		},
	}
}
