package models

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

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
			errors.New("invalid alertmanager choice"),
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
