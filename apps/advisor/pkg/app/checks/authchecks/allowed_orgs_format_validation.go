package authchecks

import (
	"context"
	"fmt"

	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/util"
)

const AllowedOrgsFormatValidationStepID = "allowed-organizations-format-validation"

var _ checks.Step = (*allowedOrganizationsFormatValidation)(nil)

// allowedOrganizationsFormatValidation checks if the 'allowed_organizations' setting is in a valid format.
type allowedOrganizationsFormatValidation struct{}

func (s *allowedOrganizationsFormatValidation) ID() string {
	return AllowedOrgsFormatValidationStepID
}

func (s *allowedOrganizationsFormatValidation) Title() string {
	return "Allowed Organizations format validation"
}

func (s *allowedOrganizationsFormatValidation) Description() string {
	return "Checks if the 'allowed_organizations' setting is in a valid format."
}

func (s *allowedOrganizationsFormatValidation) Resolution() string {
	return fmt.Sprintf("Configure the 'allowed_organizations' setting using a valid format. Like comma-separated values (\"org1\", \"org2\") or JSON array format ([\"org1\", \"org2\"]).")
}

func (s *allowedOrganizationsFormatValidation) Run(ctx context.Context, _ *advisor.CheckSpec, objToCheck any) (*advisor.CheckReportFailure, error) {
	setting, ok := objToCheck.(*models.SSOSettings)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", objToCheck)
	}

	allowedOrgsSetting, exists := setting.Settings["allowed_organizations"]
	if !exists || allowedOrgsSetting == nil {
		// If the setting is not present, its format is not invalid.
		return nil, nil
	}

	_, err := util.SplitStringWithError(allowedOrgsSetting.(string))
	if err != nil {
		return checks.NewCheckReportFailure(
			advisor.CheckReportFailureSeverityHigh,
			s.ID(),
			fmt.Sprintf("%s - Invalid format: %s", setting.Provider, allowedOrgsSetting),
			setting.Provider,
			[]advisor.CheckErrorLink{},
		), nil
	}

	return nil, nil
}
