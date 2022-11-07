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
	// InstanceStateError is for a erroring alert.
	InstanceStateError InstanceStateType = "Error"
)

// IsValid checks that the value of InstanceStateType is a valid
// string.
func (i InstanceStateType) IsValid() bool {
	return i == InstanceStateFiring ||
		i == InstanceStateNormal ||
		i == InstanceStateNoData ||
		i == InstanceStatePending ||
		i == InstanceStateError
}

// SaveAlertInstanceCommand is the query for saving a new alert instance.
type SaveAlertInstanceCommand struct {
	RuleOrgID         int64
	RuleUID           string
	Labels            InstanceLabels
	State             InstanceStateType
	LastEvalTime      time.Time
	CurrentStateSince time.Time
	CurrentStateEnd   time.Time
}

// GetAlertInstanceQuery is the query for retrieving/deleting an alert definition by ID.
// nolint:unused
type GetAlertInstanceQuery struct {
	RuleOrgID int64
	RuleUID   string
	Labels    InstanceLabels

	Result *AlertInstance
}

// ListAlertInstancesQuery is the query list alert Instances.
type ListAlertInstancesQuery struct {
	RuleOrgID int64 `json:"-"`
	RuleUID   string
	State     InstanceStateType

	Result []*ListAlertInstancesQueryResult
}

// ListAlertInstancesQueryResult represents the result of listAlertInstancesQuery.
type ListAlertInstancesQueryResult struct {
	RuleOrgID         int64             `xorm:"rule_org_id" json:"ruleOrgId"`
	RuleUID           string            `xorm:"rule_uid" json:"ruleUid"`
	Labels            InstanceLabels    `json:"labels"`
	LabelsHash        string            `json:"labeHash"`
	CurrentState      InstanceStateType `json:"currentState"`
	CurrentStateSince time.Time         `json:"currentStateSince"`
	CurrentStateEnd   time.Time         `json:"currentStateEnd"`
	LastEvalTime      time.Time         `json:"lastEvalTime"`
}

// ValidateAlertInstance validates that the alert instance contains an alert rule id,
// and state.
func ValidateAlertInstance(alertInstance *AlertInstance) error {
	if alertInstance == nil {
		return fmt.Errorf("alert instance is invalid because it is nil")
	}

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
