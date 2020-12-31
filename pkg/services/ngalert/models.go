package ngalert

import (
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
)

var errAlertDefinitionFailedGenerateUniqueUID = errors.New("failed to generate alert definition UID")

// AlertDefinition is the model for alert definitions in Alerting NG.
type AlertDefinition struct {
	ID              int64 `xorm:"pk autoincr 'id'"`
	OrgID           int64 `xorm:"org_id"`
	Title           string
	Condition       string
	Data            []eval.AlertQuery
	Updated         time.Time
	IntervalSeconds int64
	Version         int64
	UID             string `xorm:"uid"`
}

// AlertDefinitionVersion is the model for alert definition versions in Alerting NG.
type AlertDefinitionVersion struct {
	ID                 int64  `xorm:"pk autoincr 'id'"`
	AlertDefinitionID  int64  `xorm:"alert_definition_id"`
	AlertDefinitionUID string `xorm:"alert_definition_uid"`
	ParentVersion      int64
	RestoredFrom       int64
	Version            int64

	Created         time.Time
	Title           string
	Condition       string
	Data            []eval.AlertQuery
	IntervalSeconds int64
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
	Title           string         `json:"title"`
	OrgID           int64          `json:"-"`
	Condition       eval.Condition `json:"condition"`
	IntervalSeconds *int64         `json:"interval_seconds"`

	Result *AlertDefinition
}

// updateAlertDefinitionCommand is the query for updating an existing alert definition.
type updateAlertDefinitionCommand struct {
	ID              int64          `json:"-"`
	Title           string         `json:"title"`
	OrgID           int64          `json:"-"`
	Condition       eval.Condition `json:"condition"`
	IntervalSeconds *int64         `json:"interval_seconds"`
	UID             string         `json:"-"`

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
