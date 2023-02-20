package models

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestInstanceStateType_IsValid(t *testing.T) {
	testCases := []struct {
		name         string
		instanceType InstanceStateType
		expected     bool
	}{
		{
			name:         "\"Alerting\" should be valid",
			instanceType: InstanceStateFiring,
			expected:     true,
		},
		{
			name:         "\"Normal\" should be valid",
			instanceType: InstanceStateNormal,
			expected:     true,
		},
		{
			name:         "\"Pending\" should be valid",
			instanceType: InstanceStatePending,
			expected:     true,
		},
		{
			name:         "\"NoData\" should be valid",
			instanceType: InstanceStateNoData,
			expected:     true,
		},
		{
			name:         "\"Error\" should be valid",
			instanceType: InstanceStateError,
			expected:     true,
		},
		{
			name:         "\"notAValidInstanceStateType\" should not be valid",
			instanceType: InstanceStateType("notAValidInstanceStateType"),
			expected:     false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expected, tc.instanceType.IsValid())
		})
	}
}

func TestInstanceCauseType_IsValid(t *testing.T) {
	testCases := []struct {
		name              string
		instanceCauseType InstanceCauseType
		expected          bool
	}{
		{
			name:              "\"\" should be valid",
			instanceCauseType: InstanceCauseNone,
			expected:          true,
		},
		{
			name:              "\"Firing\" should be valid",
			instanceCauseType: InstanceCauseFiring,
			expected:          true,
		},
		{
			name:              "\"Error\" should be valid",
			instanceCauseType: InstanceCauseError,
			expected:          true,
		},
		{
			name:              "\"NoData\" should be valid",
			instanceCauseType: InstanceCauseNoData,
			expected:          true,
		},
		{
			name:              "\"notAValidInstancePendingStateType\" should not be valid",
			instanceCauseType: InstanceCauseType("notAValidInstancePendingStateType"),
			expected:          false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expected, tc.instanceCauseType.IsValid())
		})
	}
}

func TestAlertInstance_AreCurrentStateAndCurrentPendingStateValidTogether(t *testing.T) {
	testCases := []struct {
		name                string
		currentState        InstanceStateType
		currentPendingState InstanceCauseType
		expected            bool
	}{
		{
			name:                "CurrentState \"Normal\" and CurrentCause \"\" should be valid",
			currentState:        InstanceStateNormal,
			currentPendingState: InstanceCauseNone,
			expected:            true,
		},
		{
			name:                "CurrentState \"Normal\" and CurrentCause \"Firing\" should not be valid",
			currentState:        InstanceStateNormal,
			currentPendingState: InstanceCauseFiring,
			expected:            false,
		},
		{
			name:                "CurrentState \"Normal\" and CurrentCause \"Error\" should be valid",
			currentState:        InstanceStateNormal,
			currentPendingState: InstanceCauseError,
			expected:            true,
		},
		{
			name:                "CurrentState \"Normal\" and CurrentCause \"NoData\" should be valid",
			currentState:        InstanceStateNormal,
			currentPendingState: InstanceCauseNoData,
			expected:            true,
		},
		{
			name:                "CurrentState \"Alerting\" and CurrentCause \"\" should not be valid",
			currentState:        InstanceStateFiring,
			currentPendingState: InstanceCauseNone,
			expected:            false,
		},
		{
			name:                "CurrentState \"Alerting\" and CurrentCause \"Firing\" should be valid",
			currentState:        InstanceStateFiring,
			currentPendingState: InstanceCauseFiring,
			expected:            true,
		},
		{
			name:                "CurrentState \"Alerting\" and CurrentCause \"Error\" should be valid",
			currentState:        InstanceStateFiring,
			currentPendingState: InstanceCauseError,
			expected:            true,
		},
		{
			name:                "CurrentState \"Alerting\" and CurrentCause \"NoData\" should be valid",
			currentState:        InstanceStateFiring,
			currentPendingState: InstanceCauseNoData,
			expected:            true,
		},
		{
			name:                "CurrentState \"Error\" and CurrentCause \"\" should not be valid",
			currentState:        InstanceStateError,
			currentPendingState: InstanceCauseNone,
			expected:            false,
		},
		{
			name:                "CurrentState \"Error\" and CurrentCause \"Firing\" should not be valid",
			currentState:        InstanceStateError,
			currentPendingState: InstanceCauseFiring,
			expected:            false,
		},
		{
			name:                "CurrentState \"Error\" and CurrentCause \"Error\" should be valid",
			currentState:        InstanceStateError,
			currentPendingState: InstanceCauseError,
			expected:            true,
		},
		{
			name:                "CurrentState \"Error\" and CurrentCause \"NoData\" should not be valid",
			currentState:        InstanceStateError,
			currentPendingState: InstanceCauseNoData,
			expected:            false,
		},
		{
			name:                "CurrentState \"NoData\" and CurrentCause \"\" should not be valid",
			currentState:        InstanceStateNoData,
			currentPendingState: InstanceCauseNone,
			expected:            false,
		},
		{
			name:                "CurrentState \"NoData\" and CurrentCause \"Firing\" should not be valid",
			currentState:        InstanceStateNoData,
			currentPendingState: InstanceCauseFiring,
			expected:            false,
		},
		{
			name:                "CurrentState \"NoData\" and CurrentCause \"Error\" should not be valid",
			currentState:        InstanceStateNoData,
			currentPendingState: InstanceCauseError,
			expected:            false,
		},
		{
			name:                "CurrentState \"NoData\" and CurrentCause \"NoData\" should be valid",
			currentState:        InstanceStateNoData,
			currentPendingState: InstanceCauseNoData,
			expected:            true,
		},
		{
			name:                "CurrentState \"Pending\" and CurrentCause \"\" should not be valid",
			currentState:        InstanceStatePending,
			currentPendingState: InstanceCauseNone,
			expected:            false,
		},
		{
			name:                "CurrentState \"Pending\" and CurrentCause \"Firing\" should be valid",
			currentState:        InstanceStatePending,
			currentPendingState: InstanceCauseFiring,
			expected:            true,
		},
		{
			name:                "CurrentState \"Pending\" and CurrentCause \"Error\" should be valid",
			currentState:        InstanceStatePending,
			currentPendingState: InstanceCauseError,
			expected:            true,
		},
		{
			name:                "CurrentState \"Pending\" and CurrentCause \"NoData\" should not be valid",
			currentState:        InstanceStatePending,
			currentPendingState: InstanceCauseNoData,
			expected:            false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expected, validateCurrentStateAndCurrentPendingState(tc.currentState, tc.currentPendingState))
		})
	}
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
			currentPendingState: InstanceCauseNone,
			err:                 errors.New("alert instance is invalid due to missing alert rule organisation"),
		},
		{
			name:                "fails if uid is empty",
			orgId:               1,
			uid:                 "",
			currentState:        InstanceStateNormal,
			currentPendingState: InstanceCauseNone,
			err:                 errors.New("alert instance is invalid due to missing alert rule uid"),
		},
		{
			name:                "fails if current state is not valid",
			orgId:               1,
			uid:                 "validUid",
			currentState:        InstanceStateType("notAValidType"),
			currentPendingState: InstanceCauseNone,
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
			currentPendingState: InstanceCauseNone,
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
