package ngalert

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
)

// AlertDefinition is the model for alert definitions in Alerting NG.
type AlertDefinition struct {
	Id        int64
	OrgId     int64
	Name      string
	Condition string
	Data      []eval.AlertQuery
}

var (
	// errAlertDefinitionNotFound is an error for an unknown alert definition.
	errAlertDefinitionNotFound = fmt.Errorf("could not find alert definition")
)

// getAlertDefinitionByIDQuery is the query for retrieving/deleting an alert definition by ID.
type getAlertDefinitionByIDQuery struct {
	ID    int64
	OrgID int64

	Result *AlertDefinition
}

type deleteAlertDefinitionByIDQuery struct {
	ID    int64
	OrgID int64

	RowsAffected int64
}

// condition is the structure used by storing/updating alert definition commmands
type condition struct {
	RefID string `json:"refId"`

	QueriesAndExpressions []eval.AlertQuery `json:"queriesAndExpressions"`
}

// saveAlertDefinitionCommand is the query for saving a new alert definition.
type saveAlertDefinitionCommand struct {
	Name         string               `json:"name"`
	OrgID        int64                `json:"-"`
	Condition    condition            `json:"condition"`
	SignedInUser *models.SignedInUser `json:"-"`
	SkipCache    bool                 `json:"-"`

	Result *AlertDefinition
}

// IsValid validates a SaveAlertDefinitionCommand.
// Always returns true.
func (cmd *saveAlertDefinitionCommand) IsValid() bool {
	return true
}

// updateAlertDefinitionCommand is the query for updating an existing alert definition.
type updateAlertDefinitionCommand struct {
	ID           int64                `json:"-"`
	Name         string               `json:"name"`
	OrgID        int64                `json:"-"`
	Condition    condition            `json:"condition"`
	SignedInUser *models.SignedInUser `json:"-"`
	SkipCache    bool                 `json:"-"`

	RowsAffected int64
	Result       *AlertDefinition
}

// IsValid validates an UpdateAlertDefinitionCommand.
// Always returns true.
func (cmd *updateAlertDefinitionCommand) IsValid() bool {
	return true
}

type evalAlertConditionCommand struct {
	Condition eval.Condition `json:"condition"`
	Now       time.Time      `json:"now"`
}

type listAlertDefinitionsCommand struct {
	OrgID int64 `json:"-"`

	Result []*AlertDefinition
}

// AlertInstance represent a single alert instance.
type AlertInstance struct {
	OrgID             int64 `xorm:"org_id"`
	AlertDefinitionID int64 `xorm:"alert_definition_id"`
	Labels            InstanceLabels
	LabelsHash        string
	CurrentState      InstanceStateType
	CurrentStateSince time.Time
	LastEvalTime      time.Time
}

// saveAlertInstanceCommand is the query for saving a new alert instance.
type saveAlertInstanceCommand struct {
	OrgID             int64 `json:"-"`
	AlertDefinitionID int64
	Labels            InstanceLabels
	State             InstanceStateType
	SignedInUser      *models.SignedInUser `json:"-"`
	SkipCache         bool                 `json:"-"`
}

type InstanceStateType string

const (
	InstateStateFiring InstanceStateType = "firing"
	InstateStateNormal InstanceStateType = "normal"
)

func (i InstanceStateType) IsValid() bool {
	return i == InstateStateFiring ||
		i == InstateStateNormal
}

// getAlertDefinitionByIDQuery is the query for retrieving/deleting an alert definition by ID.
type getAlertInstanceCommand struct {
	OrgID             int64
	AlertDefinitionID int64
	Labels            InstanceLabels

	Result *AlertInstance
}
