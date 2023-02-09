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

func TestInstancePendingStateType_IsValid(t *testing.T) {
	testCases := []struct {
		instancePendingType InstancePendingStateType
		expectedValidity    bool
	}{
		{
			instancePendingType: InstancePendingStateEmpty,
			expectedValidity:    true,
		},
		{
			instancePendingType: InstancePendingStateFiring,
			expectedValidity:    true,
		},
		{
			instancePendingType: InstancePendingStateError,
			expectedValidity:    true,
		},
		{
			instancePendingType: InstancePendingStateType("notAValidInstancePendingStateType"),
			expectedValidity:    false,
		},
	}

	for _, tc := range testCases {
		t.Run(buildTestInstancePendingStateTypeIsValidName(tc.instancePendingType, tc.expectedValidity), func(t *testing.T) {
			require.Equal(t, tc.expectedValidity, tc.instancePendingType.IsValid())
		})
	}
}

func buildTestInstancePendingStateTypeIsValidName(instancePendingType InstancePendingStateType, expectedValidity bool) string {
	if expectedValidity {
		return fmt.Sprintf("%q should be valid", instancePendingType)
	}
	return fmt.Sprintf("%q should not be valid", instancePendingType)
}

func TestAlertInstance_AreCurrentStateAndCurrentPendingStateValidTogether(t *testing.T) {
	testCases := []struct {
		currentState        InstanceStateType
		currentPendingState InstancePendingStateType
		expectedValidity    bool
	}{
		{
			currentState:        InstanceStateNormal,
			currentPendingState: InstancePendingStateEmpty,
			expectedValidity:    true,
		},
		{
			currentState:        InstanceStateNormal,
			currentPendingState: InstancePendingStateFiring,
			expectedValidity:    false,
		},
		{
			currentState:        InstanceStateNormal,
			currentPendingState: InstancePendingStateError,
			expectedValidity:    false,
		},
		{
			currentState:        InstanceStateFiring,
			currentPendingState: InstancePendingStateEmpty,
			expectedValidity:    true,
		},
		{
			currentState:        InstanceStateFiring,
			currentPendingState: InstancePendingStateFiring,
			expectedValidity:    false,
		},
		{
			currentState:        InstanceStateFiring,
			currentPendingState: InstancePendingStateError,
			expectedValidity:    false,
		},
		{
			currentState:        InstanceStateError,
			currentPendingState: InstancePendingStateEmpty,
			expectedValidity:    true,
		},
		{
			currentState:        InstanceStateError,
			currentPendingState: InstancePendingStateFiring,
			expectedValidity:    false,
		},
		{
			currentState:        InstanceStateError,
			currentPendingState: InstancePendingStateError,
			expectedValidity:    false,
		},
		{
			currentState:        InstanceStateNoData,
			currentPendingState: InstancePendingStateEmpty,
			expectedValidity:    true,
		},
		{
			currentState:        InstanceStateNoData,
			currentPendingState: InstancePendingStateFiring,
			expectedValidity:    false,
		},
		{
			currentState:        InstanceStateNoData,
			currentPendingState: InstancePendingStateError,
			expectedValidity:    false,
		},
		{
			currentState:        InstanceStatePending,
			currentPendingState: InstancePendingStateEmpty,
			expectedValidity:    false,
		},
		{
			currentState:        InstanceStatePending,
			currentPendingState: InstancePendingStateFiring,
			expectedValidity:    true,
		},
		{
			currentState:        InstanceStatePending,
			currentPendingState: InstancePendingStateError,
			expectedValidity:    true,
		},
	}

	for _, tc := range testCases {
		t.Run(buildTestValidateCurrentStateAndCurrentPendingStateName(tc.currentState, tc.currentPendingState, tc.expectedValidity), func(t *testing.T) {
			require.Equal(t, tc.expectedValidity, validateCurrentStateAndCurrentPendingState(tc.currentState, tc.currentPendingState))
		})
	}
}

func buildTestValidateCurrentStateAndCurrentPendingStateName(cState InstanceStateType, cPendingState InstancePendingStateType, expectedValidity bool) string {
	if expectedValidity {
		return fmt.Sprintf("CurrentState %q and CurrentPendingState %q should be valid", cState, cPendingState)
	}
	return fmt.Sprintf("CurrentState %q and CurrentPendingState %q should not be valid", cState, cPendingState)
}

func TestValidateAlertInstance(t *testing.T) {
	testCases := []struct {
		name                string
		orgId               int64
		uid                 string
		currentState        InstanceStateType
		currentPendingState InstancePendingStateType
		err                 error
	}{
		{
			name:                "fails if orgID is empty",
			orgId:               0,
			uid:                 "validUid",
			currentState:        InstanceStateNormal,
			currentPendingState: InstancePendingStateEmpty,
			err:                 errors.New("alert instance is invalid due to missing alert rule organisation"),
		},
		{
			name:                "fails if uid is empty",
			orgId:               1,
			uid:                 "",
			currentState:        InstanceStateNormal,
			currentPendingState: InstancePendingStateEmpty,
			err:                 errors.New("alert instance is invalid due to missing alert rule uid"),
		},
		{
			name:                "fails if current state is not valid",
			orgId:               1,
			uid:                 "validUid",
			currentState:        InstanceStateType("notAValidType"),
			currentPendingState: InstancePendingStateEmpty,
			err:                 errors.New("alert instance is invalid because the state \"notAValidType\" is invalid"),
		},
		{
			name:                "fails if current pending state is not valid",
			orgId:               1,
			uid:                 "validUid",
			currentState:        InstanceStateNormal,
			currentPendingState: InstancePendingStateType("notAValidType"),
			err:                 errors.New("alert instance is invalid because the pending state \"notAValidType\" is invalid"),
		},
		{
			name:                "fails if current state and current pending state are not a valid pair",
			orgId:               1,
			uid:                 "validUid",
			currentState:        InstanceStateNormal,
			currentPendingState: InstancePendingStateFiring,
			err:                 errors.New("alert instance is invalid because the state \"Normal\" and pending state \"AlertingPending\" are not a valid pair"),
		},
		{
			name:                "ok if validated fields are correct",
			orgId:               1,
			uid:                 "validUid",
			currentState:        InstanceStateNormal,
			currentPendingState: InstancePendingStateEmpty,
			err:                 nil,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			instance := AlertInstanceGen(func(instance *AlertInstance) {
				instance.AlertInstanceKey.RuleOrgID = tc.orgId
				instance.AlertInstanceKey.RuleUID = tc.uid
				instance.CurrentState = tc.currentState
				instance.CurrentPendingState = tc.currentPendingState
			})

			require.Equal(t, tc.err, ValidateAlertInstance(*instance))
		})
	}
}
