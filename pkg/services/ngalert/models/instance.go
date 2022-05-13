package models

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

// AlertInstance represents a single alert instance.
type AlertInstance struct {
	RuleOrgID         int64  `xorm:"rule_org_id"`
	RuleUID           string `xorm:"rule_uid"`
	Labels            InstanceLabels
	LabelsHash        string
	CurrentState      InstanceState
	CurrentStateSince time.Time
	CurrentStateEnd   time.Time
	LastEvalTime      time.Time
}

func ErrInvalidInstanceState(i *InstanceState) error {
	return errors.New("The InstanceState %+v is invalid")
}

// The state's Type is what the instance is doing. Alerting, Pending ...
// The state's Reason is why the state has the Type. A common case is State
type InstanceState struct {
	Type   InstanceStateType  `json:"type"`
	Reason InstanceReasonType `json:"reason"`
}

func (i InstanceState) IsValid() bool {
	return i.Type.IsValid() && i.Reason.IsValid()
}

func (i InstanceState) Equals(j InstanceState) bool {
	return i.Type == j.Type && i.Reason == j.Reason
}

func (i InstanceState) String() string {
	output := string(i.Type)

	if i.Reason != InstanceReasonNormal {

		// Don't attach the Reason for Error or NoData types - the reason should always be error or nodata.
		if i.Type != InstanceStateError && i.Type != InstanceStateNoData {
			output = output + fmt.Sprintf(" (%+v)", i.Reason)
		}
	}

	return output
}

// InstanceStateType implements json.Marshaler and json.Unmarshaler so we can
// use a simple string representation in the database, as well as the
// presentation shown in the Grafana UI.
func (i *InstanceState) MarshalJSON() ([]byte, error) {
	if !(*i).IsValid() {
		return nil, ErrInvalidInstanceState(i)
	}

	return []byte(i.String()), nil
}

func (i *InstanceState) UnmarshalJSON(b []byte) error {
	input := string(b)
	fields := strings.Split(input, " ")
	if len(fields) == 0 {
		// TODO: create a type.
		return errors.New("too few fields")
	} else if len(fields) > 2 {
		return errors.New("Too many fields")
	}

	typ := InstanceStateType(fields[0])
	switch typ {
	case InstanceStateFiring:
	case InstanceStateNormal:
	case InstanceStatePending:
	case InstanceStateNoData:
	case InstanceStateError:
	default:
		//TODO create a better error type.
		return errors.New("Bad Type field")
	}

	i.Type = typ

	if len(fields) == 2 {
		reason := InstanceReasonType(strings.Trim(fields[1], "()"))
		switch reason {
		case InstanceReasonNormal:
		case InstanceReasonNoData:
		case InstanceReasonError:
		default:
			// TODO: Better error type
			return errors.New("Bad reason field")
		}

		i.Reason = reason
	}

	// TODO: Should we error on !i.IsValid()? That would prevent unmarshalling
	// invalid data from db, but we do that already with the other matching here.

	return nil
}

// InstanceStateType is an enum for instance states.
type InstanceStateType string

func (i InstanceStateType) String() string {
	return string(i)
}

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

type InstanceReasonType string

const (
	InstanceReasonNormal = "Normal"
	InstanceReasonNoData = "NoData"
	InstanceReasonError  = "Error"
)

func (i InstanceReasonType) IsValid() bool {
	switch i {
	case InstanceReasonNormal:
	case InstanceReasonError:
	case InstanceReasonNoData:
	default:
		return false
	}

	return true
}

// SaveAlertInstanceCommand is the query for saving a new alert instance.
type SaveAlertInstanceCommand struct {
	RuleOrgID         int64
	RuleUID           string
	Labels            InstanceLabels
	State             InstanceState
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
	State     *InstanceState

	Result []*ListAlertInstancesQueryResult
}

// ListAlertInstancesQueryResult represents the result of listAlertInstancesQuery.
type ListAlertInstancesQueryResult struct {
	RuleOrgID         int64          `xorm:"rule_org_id" json:"ruleOrgId"`
	RuleUID           string         `xorm:"rule_uid" json:"ruleUid"`
	Labels            InstanceLabels `json:"labels"`
	LabelsHash        string         `json:"labeHash"`
	CurrentState      InstanceState  `json:"currentState"`
	CurrentStateSince time.Time      `json:"currentStateSince"`
	CurrentStateEnd   time.Time      `json:"currentStateEnd"`
	LastEvalTime      time.Time      `json:"lastEvalTime"`
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
