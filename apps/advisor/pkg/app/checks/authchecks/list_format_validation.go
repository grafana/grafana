package authchecks

import (
	"context"
	"fmt"
	"strings"

	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/util"
)

var _ checks.Step = (*listFormatValidation)(nil)

// listFormatValidation checks if the provided setting based on the key is in a valid format.
type listFormatValidation struct {
	stepID     string
	settingKey string
	title      string
}

// NewListFormatValidation creates a new listFormatValidation step.
func NewListFormatValidation(stepID, settingKey, title string) *listFormatValidation {
	return &listFormatValidation{
		stepID:     stepID,
		settingKey: settingKey,
		title:      title,
	}
}

func (s *listFormatValidation) ID() string {
	return s.stepID
}

func (s *listFormatValidation) Title() string {
	return s.title
}

func (s *listFormatValidation) Description() string {
	return fmt.Sprintf("Checks if the '%s' setting is in a valid format.", s.settingKey)
}

func (s *listFormatValidation) Resolution() string {
	return fmt.Sprintf("Configure the '%s' setting using a valid format. Like comma-separated values (\"opt1\", \"opt2\") or JSON array format ([\"opt 1\", \"opt 2\"]).", s.settingKey)
}

func (s *listFormatValidation) Run(ctx context.Context, _ *advisor.CheckSpec, objToCheck any) (*advisor.CheckReportFailure, error) {
	setting, ok := objToCheck.(*models.SSOSettings)
	if !ok {
		return nil, fmt.Errorf("invalid item type %T", objToCheck)
	}

	currentSetting, exists := setting.Settings[s.settingKey]
	if !exists || currentSetting == nil {
		// If the setting is not present, its format is not invalid.
		return nil, nil
	}

	_, err := util.SplitStringWithError(currentSetting.(string))
	if err != nil {
		return checks.NewCheckReportFailure(
			advisor.CheckReportFailureSeverityHigh,
			s.ID(),
			fmt.Sprintf("%s - Invalid format: %s", login.GetAuthProviderLabel(setting.Provider), currentSetting),
			setting.Provider,
			[]advisor.CheckErrorLink{
				{
					Url:     fmt.Sprintf("https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/%s", strings.ReplaceAll(setting.Provider, "_", "-")),
					Message: "Check the documentation",
				},
				{
					Url:     fmt.Sprintf("/admin/authentication/%s", setting.Provider),
					Message: "Go to authentication settings",
				},
			},
		), nil
	}

	return nil, nil
}
