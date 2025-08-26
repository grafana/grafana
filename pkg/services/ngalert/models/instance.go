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
	CurrentReason     string
	CurrentStateSince time.Time
	CurrentStateEnd   time.Time
	LastEvalTime      time.Time
	LastSentAt        *time.Time
	FiredAt           *time.Time
	ResolvedAt        *time.Time
	ResultFingerprint string
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
	// InstanceStateRecovering is for a recovering alert.
	InstanceStateRecovering InstanceStateType = "Recovering"
)

// IsValid checks that the value of InstanceStateType is a valid
// string.
func (i InstanceStateType) IsValid() bool {
	return i == InstanceStateFiring ||
		i == InstanceStateNormal ||
		i == InstanceStateNoData ||
		i == InstanceStatePending ||
		i == InstanceStateError ||
		i == InstanceStateRecovering
}

// ListAlertInstancesQuery is the query list alert Instances.
type ListAlertInstancesQuery struct {
	RuleUID   string
	RuleOrgID int64 `json:"-"`
	RuleGroup string
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
		return fmt.Errorf("alert instance is invalid because the state '%v' is invalid", alertInstance.CurrentState)
	}

	return nil
}
