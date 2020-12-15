package ngalert

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
)

// AlertDefinition is the model for alert definitions in Alerting NG.
type AlertDefinition struct {
	ID        int64 `xorm:"pk autoincr 'id'"`
	OrgID     int64 `xorm:"org_id"`
	Name      string
	Condition string
	Data      []eval.AlertQuery
	Updated   int64
	// Interval in seconds
	Interval int64
	Version  int64
}

// AlertDefinitionVersion is the model for alert definition versions in Alerting NG.
type AlertDefinitionVersion struct {
	ID                int64 `xorm:"pk autoincr 'id'"`
	AlertDefinitionID int64 `xorm:"alert_definition_id"`
	ParentVersion     int64
	RestoredFrom      int64
	Version           int64

	Created   int64
	Name      string
	Condition string
	Data      []eval.AlertQuery
	// Interval in seconds
	Interval int64
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

type deleteAlertDefinitionByIDCommand struct {
	ID    int64
	OrgID int64

	RowsAffected int64
}

// saveAlertDefinitionCommand is the query for saving a new alert definition.
type saveAlertDefinitionCommand struct {
	Name              string         `json:"name"`
	OrgID             int64          `json:"-"`
	Condition         eval.Condition `json:"condition"`
	IntervalInSeconds *int64         `json:"interval"`

	Result *AlertDefinition
}

// updateAlertDefinitionCommand is the query for updating an existing alert definition.
type updateAlertDefinitionCommand struct {
	ID                int64          `json:"-"`
	Name              string         `json:"name"`
	OrgID             int64          `json:"-"`
	Condition         eval.Condition `json:"condition"`
	IntervalInSeconds *int64         `json:"interval"`

	RowsAffected int64
	Result       *AlertDefinition
}

type evalAlertConditionCommand struct {
	Condition eval.Condition `json:"condition"`
	Now       time.Time      `json:"now"`
}

type listAlertDefinitionsQuery struct {
	OrgID int64 `json:"-"`

	Result []*AlertDefinition
}
