package models

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateRequiredAnnotations(t *testing.T) {
	bp := func(b bool) *bool { return &b }
	alerting := func(annotations map[string]string) *AlertRule {
		return &AlertRule{Annotations: annotations}
	}

	tests := []struct {
		name      string
		rule      *AlertRule
		cfg       *AdminConfiguration
		wantError bool
	}{
		{
			name: "no config means no requirements",
			rule: alerting(nil),
			cfg:  nil,
		},
		{
			name: "toggles off means no requirements",
			rule: alerting(nil),
			cfg:  &AdminConfiguration{},
		},
		{
			name:      "require descriptions rejects missing summary and description",
			rule:      alerting(map[string]string{RunbookURLAnnotation: "https://r"}),
			cfg:       &AdminConfiguration{RejectAlertsWithoutDescriptions: bp(true)},
			wantError: true,
		},
		{
			name:      "require descriptions rejects whitespace-only values",
			rule:      alerting(map[string]string{SummaryAnnotation: "  ", DescriptionAnnotation: "ok"}),
			cfg:       &AdminConfiguration{RejectAlertsWithoutDescriptions: bp(true)},
			wantError: true,
		},
		{
			name: "require descriptions passes when both present",
			rule: alerting(map[string]string{SummaryAnnotation: "s", DescriptionAnnotation: "d"}),
			cfg:  &AdminConfiguration{RejectAlertsWithoutDescriptions: bp(true)},
		},
		{
			name:      "require runbook rejects when missing",
			rule:      alerting(map[string]string{SummaryAnnotation: "s", DescriptionAnnotation: "d"}),
			cfg:       &AdminConfiguration{RejectAlertsWithoutRunbookURL: bp(true)},
			wantError: true,
		},
		{
			name: "require runbook passes when present",
			rule: alerting(map[string]string{RunbookURLAnnotation: "https://r"}),
			cfg:  &AdminConfiguration{RejectAlertsWithoutRunbookURL: bp(true)},
		},
		{
			name:      "recording rules are exempt",
			rule:      &AlertRule{Record: &Record{}},
			cfg:       &AdminConfiguration{RejectAlertsWithoutDescriptions: bp(true), RejectAlertsWithoutRunbookURL: bp(true)},
			wantError: false,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(tt *testing.T) {
			err := ValidateRequiredAnnotations(test.rule, test.cfg)
			if test.wantError {
				require.Error(tt, err)
				require.ErrorIs(tt, err, ErrAlertRuleFailedValidation)
			} else {
				require.NoError(tt, err)
			}
		})
	}
}

func TestStringToAlertmanagersChoice(t *testing.T) {
	tests := []struct {
		name                string
		str                 string
		alertmanagersChoice AlertmanagersChoice
		err                 error
	}{
		{
			"all alertmanagers",
			"all",
			AllAlertmanagers,
			nil,
		},
		{
			"internal alertmanager",
			"internal",
			InternalAlertmanager,
			nil,
		},
		{
			"external alertmanagers",
			"external",
			ExternalAlertmanagers,
			nil,
		},
		{
			"empty string value",
			"",
			AllAlertmanagers,
			nil,
		},
		{
			"invalid string",
			"invalid",
			0,
			errors.New("invalid alertmanager choice: \"invalid\""),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(tt *testing.T) {
			amc, err := StringToAlertmanagersChoice(test.str)
			if test.err != nil {
				require.EqualError(tt, err, test.err.Error())
			} else {
				require.NoError(tt, err)
			}

			require.Equal(tt, amc, test.alertmanagersChoice)
		})
	}
}
