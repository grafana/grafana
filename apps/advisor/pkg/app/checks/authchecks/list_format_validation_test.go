package authchecks

import (
	"context"
	"fmt"
	"testing"

	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/stretchr/testify/require"
)

func TestListFormatValidation_Methods(t *testing.T) {
	stepID := "test-step-id"
	settingKey := "test_setting_key"
	title := "Test Title"

	validator := NewListFormatValidation(stepID, settingKey, title)

	require.Equal(t, stepID, validator.ID())
	require.Equal(t, title, validator.Title())
	require.Equal(t, fmt.Sprintf("Checks if the '%s' setting is in a valid format.", settingKey), validator.Description())
	require.Equal(t, fmt.Sprintf("Configure the '%s' setting using a valid format. Like comma-separated values (\"opt1\", \"opt2\") or JSON array format ([\"opt 1\", \"opt 2\"]).", settingKey), validator.Resolution())
}

func TestListFormatValidation_Run(t *testing.T) {
	stepID := "test-list-format-validation"
	settingKey := "allowed_groups"
	title := "Allowed Groups Format Validation"

	validator := NewListFormatValidation(stepID, settingKey, title)

	ctx := context.Background()
	spec := &advisor.CheckSpec{}

	tests := []struct {
		name            string
		objToCheck      any
		expectedError   string
		expectedFailure *advisor.CheckReportFailure
	}{
		{
			name:          "invalid object type",
			objToCheck:    struct{}{},
			expectedError: "invalid item type struct {}",
		},
		{
			name: "setting does not exist",
			objToCheck: &models.SSOSettings{
				Provider: "generic_oauth",
				Settings: map[string]any{},
			},
			expectedFailure: nil,
		},
		{
			name: "setting is nil",
			objToCheck: &models.SSOSettings{
				Provider: "generic_oauth",
				Settings: map[string]any{
					settingKey: nil,
				},
			},
			expectedFailure: nil,
		},
		{
			name: "valid comma-separated format",
			objToCheck: &models.SSOSettings{
				Provider: "generic_oauth",
				Settings: map[string]any{
					settingKey: "group1, group2",
				},
			},
			expectedFailure: nil,
		},
		{
			name: "valid JSON array format",
			objToCheck: &models.SSOSettings{
				Provider: "generic_oauth",
				Settings: map[string]any{
					settingKey: `["group1", "group2"]`,
				},
			},
			expectedFailure: nil,
		},
		{
			name: "invalid format",
			objToCheck: &models.SSOSettings{
				Provider: "generic_oauth",
				Settings: map[string]any{
					settingKey: `["group1", "group2"`,
				},
			},
			expectedFailure: checks.NewCheckReportFailure(
				advisor.CheckReportFailureSeverityHigh,
				stepID,
				fmt.Sprintf("Generic OAuth - Invalid format: %s", `["group1", "group2"`),
				"generic_oauth",
				[]advisor.CheckErrorLink{
					{Url: "https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/generic-oauth", Message: "Go to the documentation"},
					{Url: "/admin/authentication/generic_oauth", Message: "Go to authentication settings"},
				},
			),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var failure *advisor.CheckReportFailure
			var err error

			failure, err = validator.Run(ctx, spec, tt.objToCheck)

			if tt.expectedError != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.expectedError)
				require.Nil(t, failure)
				return
			}

			require.NoError(t, err)
			if tt.expectedFailure != nil && failure != nil {
				require.Equal(t, tt.expectedFailure.Severity, failure.Severity)
				require.Equal(t, tt.expectedFailure.StepID, failure.StepID)
				require.Equal(t, tt.expectedFailure.Item, failure.Item)
				require.Equal(t, tt.expectedFailure.ItemID, failure.ItemID)
				require.ElementsMatch(t, tt.expectedFailure.Links, failure.Links)
			} else {
				require.Equal(t, tt.expectedFailure, failure)
			}
		})
	}
}
