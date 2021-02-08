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
	ID              int64             `xorm:"pk autoincr 'id'" json:"id"`
	OrgID           int64             `xorm:"org_id" json:"orgId"`
	Title           string            `json:"title"`
	Condition       string            `json:"condition"`
	Data            []eval.AlertQuery `json:"data"`
	Updated         time.Time         `json:"updated"`
	IntervalSeconds int64             `json:"intervalSeconds"`
	Version         int64             `json:"version"`
	UID             string            `xorm:"uid" json:"uid"`
	Paused          bool              `json:"paused"`
}

type alertDefinitionKey struct {
	orgID         int64
	definitionUID string
}

func (k alertDefinitionKey) String() string {
	return fmt.Sprintf("{orgID: %d, definitionUID: %s}", k.orgID, k.definitionUID)
}

func (alertDefinition *AlertDefinition) getKey() alertDefinitionKey {
	return alertDefinitionKey{orgID: alertDefinition.OrgID, definitionUID: alertDefinition.UID}
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

// getAlertDefinitionByUIDQuery is the query for retrieving/deleting an alert definition by UID and organisation ID.
type getAlertDefinitionByUIDQuery struct {
	UID   string
	OrgID int64

	Result *AlertDefinition
}

type deleteAlertDefinitionByUIDCommand struct {
	UID   string
	OrgID int64
}

// saveAlertDefinitionCommand is the query for saving a new alert definition.
type saveAlertDefinitionCommand struct {
	Title           string            `json:"title"`
	OrgID           int64             `json:"-"`
	Condition       string            `json:"condition"`
	Data            []eval.AlertQuery `json:"data"`
	IntervalSeconds *int64            `json:"intervalSeconds"`

	Result *AlertDefinition
}

// updateAlertDefinitionCommand is the query for updating an existing alert definition.
type updateAlertDefinitionCommand struct {
	Title           string            `json:"title"`
	OrgID           int64             `json:"-"`
	Condition       string            `json:"condition"`
	Data            []eval.AlertQuery `json:"data"`
	IntervalSeconds *int64            `json:"intervalSeconds"`
	UID             string            `json:"-"`

	Result *AlertDefinition
}

type evalAlertConditionCommand struct {
	Condition string            `json:"condition"`
	Data      []eval.AlertQuery `json:"data"`
	Now       time.Time         `json:"now"`
}

type listAlertDefinitionsQuery struct {
	OrgID int64 `json:"-"`

	Result []*AlertDefinition
}

type updateAlertDefinitionPausedCommand struct {
	OrgID  int64    `json:"-"`
	UIDs   []string `json:"uids"`
	Paused bool     `json:"-"`

	ResultCount int64
}
