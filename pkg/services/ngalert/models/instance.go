package models

import (
	"fmt"
	"time"
)

// AlertInstance represents a single alert instance.
type AlertInstance struct {
	AlertInstanceKey  `xorm:"extends"`
	Labels            InstanceLabels
	CurrentState      InstanceStateType
	CurrentCause      InstanceCauseType
	CurrentReason     string
	CurrentStateSince time.Time
	CurrentStateEnd   time.Time
	LastEvalTime      time.Time
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

// InstanceCauseType is an enum to differentiate between the different pending states.
type InstanceCauseType string

const (
	// InstanceCauseNone is for any state that does not come from firing or error.
	InstanceCauseNone InstanceCauseType = ""
	// InstanceCauseFiring is to identify states caused by firing states.
	InstanceCauseFiring InstanceCauseType = "Firing"
	// InstanceCauseError is to identify states caused by erroring states.
	InstanceCauseError InstanceCauseType = "Error"
	// InstanceCauseNoData is to identify states caused by nodata states.
	InstanceCauseNoData InstanceCauseType = "NoData"
)

// IsValid checks that the value of InstanceStateType is a valid string.
func (i InstanceStateType) IsValid() bool {
	return i == InstanceStateFiring ||
		i == InstanceStateNormal ||
		i == InstanceStateNoData ||
		i == InstanceStatePending ||
		i == InstanceStateError
}

// IsValid checks that the value of InstanceCauseType is a valid string.
func (i InstanceCauseType) IsValid() bool {
	return i == InstanceCauseNone ||
		i == InstanceCauseFiring ||
		i == InstanceCauseError ||
		i == InstanceCauseNoData
}

// validateCurrentStateAndCurrentPendingState checks that the possible combinations of CurrentState and
// CurrentCause are valid.
func validateCurrentStateAndCurrentPendingState(cState InstanceStateType, cCause InstanceCauseType) bool {
	return (cState == InstanceStateNormal && (cCause == InstanceCauseNone || cCause == InstanceCauseError || cCause == InstanceCauseNoData)) ||
		(cState == InstanceStateFiring && (cCause == InstanceCauseFiring || cCause == InstanceCauseError || cCause == InstanceCauseNoData)) ||
		(cState == InstanceStateNoData && cCause == InstanceCauseNoData) ||
		(cState == InstanceStateError && cCause == InstanceCauseError) ||
		(cState == InstanceStatePending && (cCause == InstanceCauseFiring || cCause == InstanceCauseError))
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

	if !alertInstance.CurrentCause.IsValid() {
		return fmt.Errorf("alert instance is invalid because the cause %q is invalid", alertInstance.CurrentCause)
	}

	if !validateCurrentStateAndCurrentPendingState(alertInstance.CurrentState, alertInstance.CurrentCause) {
		return fmt.Errorf("alert instance is invalid because the state %q and cause %q are not a valid pair", alertInstance.CurrentState, alertInstance.CurrentCause)
	}

	return nil
}
