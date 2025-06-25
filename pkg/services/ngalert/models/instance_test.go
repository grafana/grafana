package models

import (
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestInstanceStateType_IsValid(t *testing.T) {
	testCases := []struct {
		instanceType     InstanceStateType
		expectedValidity bool
	}{
		{
			instanceType:     InstanceStateFiring,
			expectedValidity: true,
		},
		{
			instanceType:     InstanceStateNormal,
			expectedValidity: true,
		},
		{
			instanceType:     InstanceStatePending,
			expectedValidity: true,
		},
		{
			instanceType:     InstanceStateNoData,
			expectedValidity: true,
		},
		{
			instanceType:     InstanceStateError,
			expectedValidity: true,
		},
		{
			instanceType:     InstanceStateRecovering,
			expectedValidity: true,
		},
		{
			instanceType:     InstanceStateType("notAValidInstanceStateType"),
			expectedValidity: false,
		},
	}

	for _, tc := range testCases {
		t.Run(buildTestInstanceStateTypeIsValidName(tc.instanceType, tc.expectedValidity), func(t *testing.T) {
			require.Equal(t, tc.expectedValidity, tc.instanceType.IsValid())
		})
	}
}

func buildTestInstanceStateTypeIsValidName(instanceType InstanceStateType, expectedValidity bool) string {
	if expectedValidity {
		return fmt.Sprintf("%q should be valid", instanceType)
	}
	return fmt.Sprintf("%q should not be valid", instanceType)
}

func TestValidateAlertInstance(t *testing.T) {
	testCases := []struct {
		name         string
		orgId        int64
		uid          string
		currentState InstanceStateType
		err          error
	}{
		{
			name:         "fails if orgID is empty",
			orgId:        0,
			uid:          "validUid",
			currentState: InstanceStateNormal,
			err:          errors.New("alert instance is invalid due to missing alert rule organisation"),
		},
		{
			name:         "fails if uid is empty",
			orgId:        1,
			uid:          "",
			currentState: InstanceStateNormal,
			err:          errors.New("alert instance is invalid due to missing alert rule uid"),
		},
		{
			name:         "fails if current state is not valid",
			orgId:        1,
			uid:          "validUid",
			currentState: InstanceStateType("notAValidType"),
			err:          errors.New("alert instance is invalid because the state 'notAValidType' is invalid"),
		},
		{
			name:         "ok if validated fields are correct",
			orgId:        1,
			uid:          "validUid",
			currentState: InstanceStateNormal,
			err:          nil,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			instance := AlertInstanceGen(func(instance *AlertInstance) {
				instance.RuleOrgID = tc.orgId
				instance.RuleUID = tc.uid
				instance.CurrentState = tc.currentState
			})

			require.Equal(t, tc.err, ValidateAlertInstance(*instance))
		})
	}
}
