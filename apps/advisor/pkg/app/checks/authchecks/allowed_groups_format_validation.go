package authchecks

import (
	"context"
	"fmt"

	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/util"
)

const AllowedGroupsFormatValidationStepID = "allowed-groups-format-validation"

var _ checks.Step = (*allowedGroupsFormatValidation)(nil)

// allowedGroupsFormatValidation checks if the 'allowed_groups' setting is in a valid format.
type allowedGroupsFormatValidation struct{}

func (s *allowedGroupsFormatValidation) ID() string {
	return AllowedGroupsFormatValidationStepID
}

func (s *allowedGroupsFormatValidation) Title() string {
	return "Allowed Groups format validation"
}

func (s *allowedGroupsFormatValidation) Description() string {
	return "Checks if the 'allowed_groups' setting is in a valid format."
}

func (s *allowedGroupsFormatValidation) Resolution() string {
	return fmt.Sprintf("Configure the 'allowed_groups' setting setting using a valid format. Like comma-separated values (\"org1\", \"org2\") or JSON array format ([\"org1\", \"org2\"]).")
}

func (s *allowedGroupsFormatValidation) Run(ctx context.Context, _ *advisor.CheckSpec, objToCheck any) (*advisor.CheckReportFailure, error) {
	setting, ok := objToCheck.(*models.SSOSettings)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", objToCheck)
	}

	allowedGroupsSetting, exists := setting.Settings["allowed_groups"]
	if !exists || allowedGroupsSetting == nil {
		// If the setting is not present, its format is not invalid.
		return nil, nil
	}

	_, err := util.SplitStringWithError(allowedGroupsSetting.(string))
	if err != nil {
		return checks.NewCheckReportFailure(
			advisor.CheckReportFailureSeverityHigh,
			s.ID(),
			fmt.Sprintf("%s - Invalid format: %s", setting.Provider, allowedGroupsSetting),
			setting.Provider,
			[]advisor.CheckErrorLink{},
		), nil
	}

	return nil, nil
}
