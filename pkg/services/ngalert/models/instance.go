package models

import (
	"fmt"
	"time"
)

// AlertInstance represents a single alert instance.
type AlertInstance struct {
	AlertInstanceKey    `xorm:"extends"`
	Labels              InstanceLabels
	CurrentState        InstanceStateType
	CurrentPendingState InstancePendingStateType
	CurrentReason       string
	CurrentStateSince   time.Time
	CurrentStateEnd     time.Time
	LastEvalTime        time.Time
}

type AlertInstanceKey struct {
	RuleOrgID  int64  `xorm:"rule_org_id"`
	RuleUID    string `xorm:"rule_uid"`
	LabelsHash string
}

// InstanceStateType is an enum for instance states.
type InstanceStateType string

const (
	// InstanceStateFiring is for a firing alert.
	InstanceStateFiring InstanceStateType = "Alerting"
	// InstanceStateNormal is for a normal alert.
	InstanceStateNormal InstanceStateType = "Normal"
	// InstanceStatePending is for an alert that is firing but has not met the duration
	InstanceStatePending InstanceStateType = "Pending"
	// InstanceStateNoData is for an alert with no data.
	InstanceStateNoData InstanceStateType = "NoData"
	// InstanceStateError is for an erroring alert.
	InstanceStateError InstanceStateType = "Error"
)

// InstancePendingStateType is an enum to differentiate between the different pending states.
type InstancePendingStateType string

const (
	// InstancePendingStateEmpty is for any state different that Pending.
	InstancePendingStateEmpty InstancePendingStateType = ""
	// InstancePendingStateFiring is for pending state of a firing alert.
	InstancePendingStateFiring InstancePendingStateType = "AlertingPending"
	// InstancePendingStateError is for pending state of an erroring alert.
	InstancePendingStateError InstancePendingStateType = "ErrorPending"
)

// IsValid checks that the value of InstanceStateType is a valid string.
func (i InstanceStateType) IsValid() bool {
	return i == InstanceStateFiring ||
		i == InstanceStateNormal ||
		i == InstanceStateNoData ||
		i == InstanceStatePending ||
		i == InstanceStateError
}

// IsValid checks that the value of InstancePendingStateType is a valid string.
func (i InstancePendingStateType) IsValid() bool {
	return i == InstancePendingStateEmpty ||
		i == InstancePendingStateFiring ||
		i == InstancePendingStateError
}

// validateCurrentStateAndCurrentPendingState checks that the possible combinations of CurrentState and
// CurrentPendingState are valid.
func validateCurrentStateAndCurrentPendingState(cState InstanceStateType, cPendingState InstancePendingStateType) bool {
	return (cState == InstanceStateNormal && cPendingState == InstancePendingStateEmpty) ||
		(cState == InstanceStateFiring && cPendingState == InstancePendingStateEmpty) ||
		(cState == InstanceStateNoData && cPendingState == InstancePendingStateEmpty) ||
		(cState == InstanceStateError && cPendingState == InstancePendingStateEmpty) ||
		(cState == InstanceStatePending &&
			(cPendingState == InstancePendingStateFiring ||
				cPendingState == InstancePendingStateError))
}

// ListAlertInstancesQuery is the query list alert Instances.
type ListAlertInstancesQuery struct {
	RuleUID   string
	RuleOrgID int64 `json:"-"`

	Result []*AlertInstance
}

// ValidateAlertInstance validates that the alert instance contains an alert rule id,
// and state.
func ValidateAlertInstance(alertInstance AlertInstance) error {
	if alertInstance.RuleOrgID == 0 {
		return fmt.Errorf("alert instance is invalid due to missing alert rule organisation")
	}

	if alertInstance.RuleUID == "" {
		return fmt.Errorf("alert instance is invalid due to missing alert rule uid")
	}

	if !alertInstance.CurrentState.IsValid() {
		return fmt.Errorf("alert instance is invalid because the state %q is invalid", alertInstance.CurrentState)
	}

	if !alertInstance.CurrentPendingState.IsValid() {
		return fmt.Errorf("alert instance is invalid because the pending state %q is invalid", alertInstance.CurrentPendingState)
	}

	if !validateCurrentStateAndCurrentPendingState(alertInstance.CurrentState, alertInstance.CurrentPendingState) {
		return fmt.Errorf("alert instance is invalid because the state %q and pending state %q are not a valid pair", alertInstance.CurrentState, alertInstance.CurrentPendingState)
	}

	return nil
}
