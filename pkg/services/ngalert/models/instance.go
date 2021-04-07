package models

import (
	"fmt"
	"time"
)

// AlertInstance represents a single alert instance.
type AlertInstance struct {
	DefinitionOrgID   int64  `xorm:"def_org_id"`
	DefinitionUID     string `xorm:"def_uid"`
	Labels            InstanceLabels
	LabelsHash        string
	CurrentState      InstanceStateType
	CurrentStateSince time.Time
	CurrentStateEnd   time.Time
	LastEvalTime      time.Time
}

// InstanceStateType is an enum for instance states.
type InstanceStateType string

const (
	// InstanceStateFiring is for a firing alert.
	InstanceStateFiring InstanceStateType = "Alerting"
	// InstanceStateNormal is for a normal alert.
	InstanceStateNormal InstanceStateType = "Normal"
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
		i == InstanceStateError
}

// SaveAlertInstanceCommand is the query for saving a new alert instance.
type SaveAlertInstanceCommand struct {
	DefinitionOrgID   int64
	DefinitionUID     string
	Labels            InstanceLabels
	State             InstanceStateType
	LastEvalTime      time.Time
	CurrentStateSince time.Time
	CurrentStateEnd   time.Time
}

// GetAlertInstanceQuery is the query for retrieving/deleting an alert definition by ID.
// nolint:unused
type GetAlertInstanceQuery struct {
	DefinitionOrgID int64
	DefinitionUID   string
	Labels          InstanceLabels

	Result *AlertInstance
}

// ListAlertInstancesQuery is the query list alert Instances.
type ListAlertInstancesQuery struct {
	DefinitionOrgID int64 `json:"-"`
	DefinitionUID   string
	State           InstanceStateType

	Result []*ListAlertInstancesQueryResult
}

type FetchUniqueOrgIdsQuery struct {
	Result []*FetchUniqueOrgIdsQueryResult
}

// ListAlertInstancesQueryResult represents the result of listAlertInstancesQuery.
type ListAlertInstancesQueryResult struct {
	DefinitionOrgID   int64             `xorm:"def_org_id" json:"definitionOrgId"`
	DefinitionUID     string            `xorm:"def_uid" json:"definitionUid"`
	DefinitionTitle   string            `xorm:"def_title" json:"definitionTitle"`
	Labels            InstanceLabels    `json:"labels"`
	LabelsHash        string            `json:"labeHash"`
	CurrentState      InstanceStateType `json:"currentState"`
	CurrentStateSince time.Time         `json:"currentStateSince"`
	CurrentStateEnd   time.Time         `json:"currentStateEnd"`
	LastEvalTime      time.Time         `json:"lastEvalTime"`
}

type FetchUniqueOrgIdsQueryResult struct {
	DefinitionOrgID int64 `xorm:"def_org_id" json:"definitionOrgId"`
}

// ValidateAlertInstance validates that the alert instance contains an alert definition id,
// and state.
func ValidateAlertInstance(alertInstance *AlertInstance) error {
	if alertInstance == nil {
		return fmt.Errorf("alert instance is invalid because it is nil")
	}

	if alertInstance.DefinitionOrgID == 0 {
		return fmt.Errorf("alert instance is invalid due to missing alert definition organisation")
	}

	if alertInstance.DefinitionUID == "" {
		return fmt.Errorf("alert instance is invalid due to missing alert definition uid")
	}

	if !alertInstance.CurrentState.IsValid() {
		return fmt.Errorf("alert instance is invalid because the state '%v' is invalid", alertInstance.CurrentState)
	}

	return nil
}
