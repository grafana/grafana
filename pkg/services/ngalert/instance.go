package ngalert

import (
	"fmt"

	"github.com/grafana/grafana/pkg/models"
)

// AlertInstance represent a single alert instance.
type AlertInstance struct {
	OrgID             int64 `xorm:"org_id"`
	AlertDefinitionID int64 `xorm:"alert_definition_id"`
	Labels            InstanceLabels
	LabelsHash        string
	CurrentState      InstanceStateType
	CurrentStateSince EpochTime
	LastEvalTime      EpochTime
}

// InstanceStateType is an enum for instance states.
type InstanceStateType string

const (
	// InstanceStateFiring is for a firing alert.
	InstanceStateFiring InstanceStateType = "firing"
	// InstanceStateNormal is for a normal alert.
	InstanceStateNormal InstanceStateType = "normal"
)

// IsValid checks that the value of InstanceStateType is a valid
// string.
func (i InstanceStateType) IsValid() bool {
	return i == InstanceStateFiring ||
		i == InstanceStateNormal
}

// saveAlertInstanceCommand is the query for saving a new alert instance.
// nolint:unused
type saveAlertInstanceCommand struct {
	OrgID             int64 `json:"-"`
	AlertDefinitionID int64
	Labels            InstanceLabels
	State             InstanceStateType
	SignedInUser      *models.SignedInUser `json:"-"`
	SkipCache         bool                 `json:"-"`
}

// getAlertDefinitionByIDQuery is the query for retrieving/deleting an alert definition by ID.
// nolint:unused
type getAlertInstanceCommand struct {
	OrgID             int64
	AlertDefinitionID int64
	Labels            InstanceLabels

	Result *AlertInstance
}

// listAlertInstancesCommand is the query list alert Instances.
// nolint:unused
type listAlertInstancesCommand struct {
	OrgID             int64 `json:"-"`
	AlertDefinitionID int64
	State             InstanceStateType
	SignedInUser      *models.SignedInUser `json:"-"`
	SkipCache         bool                 `json:"-"`

	Result []*AlertInstance
}

// validateAlertInstance validates that the alert instance contains an alert definition id,
// and state.
// nolint:unused
func validateAlertInstance(alertInstance *AlertInstance) error {
	if alertInstance == nil {
		return fmt.Errorf("alert instance is invalid because it is nil")
	}

	if alertInstance.AlertDefinitionID == 0 {
		return fmt.Errorf("alert instance is invalid due to missing alert definition id")
	}

	if !alertInstance.CurrentState.IsValid() {
		return fmt.Errorf("alert instance is invalid because the state '%v' is invalid", alertInstance.CurrentState)
	}

	return nil
}
