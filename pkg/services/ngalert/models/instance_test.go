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

func TestInstanceCauseType_IsValid(t *testing.T) {
	testCases := []struct {
		instanceCauseType InstanceCauseType
		expectedValidity  bool
	}{
		{
			instanceCauseType: InstanceNoCause,
			expectedValidity:  true,
		},
		{
			instanceCauseType: InstanceCauseFiring,
			expectedValidity:  true,
		},
		{
			instanceCauseType: InstanceCauseError,
			expectedValidity:  true,
		},
		{
			instanceCauseType: InstanceCauseNoData,
			expectedValidity:  true,
		},
		{
			instanceCauseType: InstanceCauseType("notAValidInstancePendingStateType"),
			expectedValidity:  false,
		},
	}

	for _, tc := range testCases {
		t.Run(buildTestInstancePendingStateTypeIsValidName(tc.instanceCauseType, tc.expectedValidity), func(t *testing.T) {
			require.Equal(t, tc.expectedValidity, tc.instanceCauseType.IsValid())
		})
	}
}

func buildTestInstancePendingStateTypeIsValidName(instancePendingType InstanceCauseType, expectedValidity bool) string {
	if expectedValidity {
		return fmt.Sprintf("%q should be valid", instancePendingType)
	}
	return fmt.Sprintf("%q should not be valid", instancePendingType)
}

func TestAlertInstance_AreCurrentStateAndCurrentPendingStateValidTogether(t *testing.T) {
	testCases := []struct {
		currentState        InstanceStateType
		currentPendingState InstanceCauseType
		expectedValidity    bool
	}{
		{
			currentState:        InstanceStateNormal,
			currentPendingState: InstanceNoCause,
			expectedValidity:    true,
		},
		{
			currentState:        InstanceStateNormal,
			currentPendingState: InstanceCauseFiring,
			expectedValidity:    false,
		},
		{
			currentState:        InstanceStateNormal,
			currentPendingState: InstanceCauseError,
			expectedValidity:    true,
		},
		{
			currentState:        InstanceStateNormal,
			currentPendingState: InstanceCauseNoData,
			expectedValidity:    true,
		},
		{
			currentState:        InstanceStateFiring,
			currentPendingState: InstanceNoCause,
			expectedValidity:    false,
		},
		{
			currentState:        InstanceStateFiring,
			currentPendingState: InstanceCauseFiring,
			expectedValidity:    true,
		},
		{
			currentState:        InstanceStateFiring,
			currentPendingState: InstanceCauseError,
			expectedValidity:    true,
		},
		{
			currentState:        InstanceStateFiring,
			currentPendingState: InstanceCauseNoData,
			expectedValidity:    true,
		},
		{
			currentState:        InstanceStateError,
			currentPendingState: InstanceNoCause,
			expectedValidity:    false,
		},
		{
			currentState:        InstanceStateError,
			currentPendingState: InstanceCauseFiring,
			expectedValidity:    false,
		},
		{
			currentState:        InstanceStateError,
			currentPendingState: InstanceCauseError,
			expectedValidity:    true,
		},
		{
			currentState:        InstanceStateError,
			currentPendingState: InstanceCauseNoData,
			expectedValidity:    false,
		},
		{
			currentState:        InstanceStateNoData,
			currentPendingState: InstanceNoCause,
			expectedValidity:    false,
		},
		{
			currentState:        InstanceStateNoData,
			currentPendingState: InstanceCauseFiring,
			expectedValidity:    false,
		},
		{
			currentState:        InstanceStateNoData,
			currentPendingState: InstanceCauseError,
			expectedValidity:    false,
		},
		{
			currentState:        InstanceStateNoData,
			currentPendingState: InstanceCauseNoData,
			expectedValidity:    true,
		},
		{
			currentState:        InstanceStatePending,
			currentPendingState: InstanceNoCause,
			expectedValidity:    false,
		},
		{
			currentState:        InstanceStatePending,
			currentPendingState: InstanceCauseFiring,
			expectedValidity:    true,
		},
		{
			currentState:        InstanceStatePending,
			currentPendingState: InstanceCauseError,
			expectedValidity:    true,
		},
		{
			currentState:        InstanceStatePending,
			currentPendingState: InstanceCauseNoData,
			expectedValidity:    false,
		},
	}

	for _, tc := range testCases {
		t.Run(buildTestValidateCurrentStateAndCurrentPendingStateName(tc.currentState, tc.currentPendingState, tc.expectedValidity), func(t *testing.T) {
			require.Equal(t, tc.expectedValidity, validateCurrentStateAndCurrentPendingState(tc.currentState, tc.currentPendingState))
		})
	}
}

func buildTestValidateCurrentStateAndCurrentPendingStateName(cState InstanceStateType, cPendingState InstanceCauseType, expectedValidity bool) string {
	if expectedValidity {
		return fmt.Sprintf("CurrentState %q and CurrentCause %q should be valid", cState, cPendingState)
	}
	return fmt.Sprintf("CurrentState %q and CurrentCause %q should not be valid", cState, cPendingState)
}

func TestValidateAlertInstance(t *testing.T) {
	testCases := []struct {
		name                string
		orgId               int64
		uid                 string
		currentState        InstanceStateType
		currentPendingState InstanceCauseType
		err                 error
	}{
		{
			name:                "fails if orgID is empty",
			orgId:               0,
			uid:                 "validUid",
			currentState:        InstanceStateNormal,
			currentPendingState: InstanceNoCause,
			err:                 errors.New("alert instance is invalid due to missing alert rule organisation"),
		},
		{
			name:                "fails if uid is empty",
			orgId:               1,
			uid:                 "",
			currentState:        InstanceStateNormal,
			currentPendingState: InstanceNoCause,
			err:                 errors.New("alert instance is invalid due to missing alert rule uid"),
		},
		{
			name:                "fails if current state is not valid",
			orgId:               1,
			uid:                 "validUid",
			currentState:        InstanceStateType("notAValidType"),
			currentPendingState: InstanceNoCause,
			err:                 errors.New("alert instance is invalid because the state \"notAValidType\" is invalid"),
		},
		{
			name:                "fails if current cause is not valid",
			orgId:               1,
			uid:                 "validUid",
			currentState:        InstanceStateNormal,
			currentPendingState: InstanceCauseType("notAValidType"),
			err:                 errors.New("alert instance is invalid because the cause \"notAValidType\" is invalid"),
		},
		{
			name:                "fails if current state and current cause are not a valid pair",
			orgId:               1,
			uid:                 "validUid",
			currentState:        InstanceStateNormal,
			currentPendingState: InstanceCauseFiring,
			err:                 errors.New("alert instance is invalid because the state \"Normal\" and cause \"Firing\" are not a valid pair"),
		},
		{
			name:                "ok if validated fields are correct",
			orgId:               1,
			uid:                 "validUid",
			currentState:        InstanceStateNormal,
			currentPendingState: InstanceNoCause,
			err:                 nil,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			instance := AlertInstanceGen(func(instance *AlertInstance) {
				instance.AlertInstanceKey.RuleOrgID = tc.orgId
				instance.AlertInstanceKey.RuleUID = tc.uid
				instance.CurrentState = tc.currentState
				instance.CurrentCause = tc.currentPendingState
			})

			require.Equal(t, tc.err, ValidateAlertInstance(*instance))
		})
	}
}
