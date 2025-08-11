package authchecks

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/grafana/grafana-app-sdk/logging"
	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apps/advisor/checks"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/stretchr/testify/require"
)

func TestListFormatValidation_Methods(t *testing.T) {
	validator := &listFormatValidation{}

	require.Equal(t, ListFormatValidationStepID, validator.ID())
	require.Equal(t, "SSO List Setting Format Validation", validator.Title())
	require.Equal(t, "Checks if list configs in SSO settings are in a valid list format (space-separated, comma-separated or JSON array).", validator.Description())
	require.Equal(t, "Configure the relevant SSO setting using a valid format, like space-separated (\"opt1 opt2\"), comma-separated values (\"opt1, opt2\") or JSON array format ([\"opt1\", \"opt2\"]).", validator.Resolution())
}

func TestListFormatValidation_Run(t *testing.T) {
	validator := &listFormatValidation{}
	ctx := context.Background()
	spec := &advisor.CheckSpec{}
	provider := "generic_oauth"
	providerLabel := login.GetAuthProviderLabel(provider)

	tests := []struct {
		name             string
		objToCheck       any
		expectedError    string
		expectedFailures []advisor.CheckReportFailure
	}{
		{
			name:          "invalid object type",
			objToCheck:    struct{}{},
			expectedError: "invalid item type struct {}",
		},
		{
			name: "no relevant settings exist",
			objToCheck: &models.SSOSettings{
				Provider: provider,
				Settings: map[string]any{"other_setting": "value"},
			},
			expectedFailures: nil,
		},
		{
			name: "one setting exists and is nil",
			objToCheck: &models.SSOSettings{
				Provider: provider,
				Settings: map[string]any{
					"allowed_groups": nil,
				},
			},
			expectedFailures: nil,
		},
		{
			name: "one setting exists and is empty string",
			objToCheck: &models.SSOSettings{
				Provider: provider,
				Settings: map[string]any{
					"allowed_groups": "",
				},
			},
			expectedFailures: nil,
		},
		{
			name: "one setting exists and is empty JSON array",
			objToCheck: &models.SSOSettings{
				Provider: provider,
				Settings: map[string]any{
					"allowed_groups": "[]",
				},
			},
			expectedFailures: nil,
		},
		{
			name: "one setting exists and is valid (comma-separated)",
			objToCheck: &models.SSOSettings{
				Provider: provider,
				Settings: map[string]any{
					"allowed_groups": "group1, group2",
				},
			},
			expectedFailures: nil,
		},
		{
			name: "one setting exists and is valid (JSON array)",
			objToCheck: &models.SSOSettings{
				Provider: provider,
				Settings: map[string]any{
					"allowed_domains": `["domain1.com", "domain2.com"]`,
				},
			},
			expectedFailures: nil,
		},
		{
			name: "one setting exists and is valid (space-separated)",
			objToCheck: &models.SSOSettings{
				Provider: provider,
				Settings: map[string]any{
					"allowed_groups": "group1 group2",
				},
			},
			expectedFailures: nil,
		},
		{
			name: "one setting exists and is not a string",
			objToCheck: &models.SSOSettings{
				Provider: provider,
				Settings: map[string]any{
					"allowed_groups": 123,
				},
			},
			expectedFailures: []advisor.CheckReportFailure{checks.NewCheckReportFailure(
				advisor.CheckReportFailureSeverityHigh,
				ListFormatValidationStepID,
				fmt.Sprintf("%s - Invalid type for '%s': expected string, got %T", providerLabel, "allowed_groups", 123),
				provider,
				generateExpectedLinks(provider),
			)},
		},
		{
			name: "one setting exists and has invalid format (bad JSON)",
			objToCheck: &models.SSOSettings{
				Provider: provider,
				Settings: map[string]any{
					"allowed_groups": `["group1", "group2"`,
				},
			},
			expectedFailures: []advisor.CheckReportFailure{checks.NewCheckReportFailure(
				advisor.CheckReportFailureSeverityHigh,
				ListFormatValidationStepID,
				fmt.Sprintf("%s - Invalid format for '%s': %s", providerLabel, "allowed_groups", `["group1", "group2"`),
				provider,
				generateExpectedLinks(provider),
			)},
		},
		{
			name: "multiple settings exist, first one is invalid (type)",
			objToCheck: &models.SSOSettings{
				Provider: provider,
				Settings: map[string]any{
					"allowed_domains": 123,
					"allowed_groups":  "group1, group2",
				},
			},
			expectedFailures: []advisor.CheckReportFailure{checks.NewCheckReportFailure(
				advisor.CheckReportFailureSeverityHigh,
				ListFormatValidationStepID,
				fmt.Sprintf("%s - Invalid type for '%s': expected string, got %T", providerLabel, "allowed_domains", 123),
				provider,
				generateExpectedLinks(provider),
			)},
		},
		{
			name: "multiple settings exist, second one is invalid (format)",
			objToCheck: &models.SSOSettings{
				Provider: provider,
				Settings: map[string]any{
					"allowed_domains": "domain1.com",
					"allowed_groups":  `["group1",`,
				},
			},
			expectedFailures: []advisor.CheckReportFailure{checks.NewCheckReportFailure(
				advisor.CheckReportFailureSeverityHigh,
				ListFormatValidationStepID,
				fmt.Sprintf("%s - Invalid format for '%s': %s", providerLabel, "allowed_groups", `["group1",`),
				provider,
				generateExpectedLinks(provider),
			)},
		},
		{
			name: "all settings exist and are valid",
			objToCheck: &models.SSOSettings{
				Provider: provider,
				Settings: map[string]any{
					"allowed_domains":           "d1.com, d2.com",
					"allowed_groups":            `["g1", "g2"]`,
					"allowed_organizations":     "org1",
					"role_values_none":          "None",
					"role_values_grafana_admin": "GrafanaAdmin",
					"role_values_admin":         "Admin",
					"role_values_editor":        "Editor",
					"role_values_viewer":        "Viewer",
				},
			},
			expectedFailures: nil,
		},
		{
			name: "returns multiple errors",
			objToCheck: &models.SSOSettings{
				Provider: provider,
				Settings: map[string]any{
					"allowed_domains":    `[\"group1\", \"group2\"]`,
					"allowed_groups":     `["group1", "group2"`,
					"role_values_editor": `["group1-`,
				},
			},
			expectedFailures: []advisor.CheckReportFailure{
				checks.NewCheckReportFailure(
					advisor.CheckReportFailureSeverityHigh,
					ListFormatValidationStepID,
					fmt.Sprintf("%s - Invalid format for '%s': %v", providerLabel, "allowed_domains", `[\"group1\", \"group2\"]`),
					provider,
					generateExpectedLinks(provider),
				),
				checks.NewCheckReportFailure(
					advisor.CheckReportFailureSeverityHigh,
					ListFormatValidationStepID,
					fmt.Sprintf("%s - Invalid format for '%s': %s", providerLabel, "allowed_groups", `["group1", "group2"`),
					provider,
					generateExpectedLinks(provider),
				),
				checks.NewCheckReportFailure(
					advisor.CheckReportFailureSeverityHigh,
					ListFormatValidationStepID,
					fmt.Sprintf("%s - Invalid format for '%s': %v", providerLabel, "role_values_editor", `["group1-`),
					provider,
					generateExpectedLinks(provider),
				),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			failures, err := validator.Run(ctx, logging.DefaultLogger, spec, tt.objToCheck)

			if tt.expectedError != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.expectedError)
				require.Nil(t, failures)
				return
			}

			require.NoError(t, err)
			if len(tt.expectedFailures) > 0 {
				require.NotNil(t, failures)
				require.Len(t, failures, len(tt.expectedFailures))
				require.ElementsMatch(t, tt.expectedFailures, failures)
			} else {
				require.Empty(t, failures, "Expected no failure reports, but got some: %+v", failures)
			}
		})
	}
}

func generateExpectedLinks(provider string) []advisor.CheckErrorLink {
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
