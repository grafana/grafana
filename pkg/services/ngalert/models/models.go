package models

import (
	"errors"
	"fmt"
	"time"
)

var (
	// ErrAlertDefinitionNotFound is an error for an unknown alert definition.
	ErrAlertDefinitionNotFound = fmt.Errorf("could not find alert definition")
	// ErrAlertDefinitionFailedGenerateUniqueUID is an error for failure to generate alert definition UID
	ErrAlertDefinitionFailedGenerateUniqueUID = errors.New("failed to generate alert definition UID")
)

// AlertDefinition is the model for alert definitions in Alerting NG.
type AlertDefinition struct {
	ID              int64        `xorm:"pk autoincr 'id'" json:"id"`
	OrgID           int64        `xorm:"org_id" json:"orgId"`
	Title           string       `json:"title"`
	Condition       string       `json:"condition"`
	Data            []AlertQuery `json:"data"`
	Updated         time.Time    `json:"updated"`
	IntervalSeconds int64        `json:"intervalSeconds"`
	Version         int64        `json:"version"`
	UID             string       `xorm:"uid" json:"uid"`
	Paused          bool         `json:"paused"`
}

// AlertDefinitionKey is the alert definition identifier
type AlertDefinitionKey struct {
	OrgID         int64
	DefinitionUID string
}

func (k AlertDefinitionKey) String() string {
	return fmt.Sprintf("{orgID: %d, definitionUID: %s}", k.OrgID, k.DefinitionUID)
}

// GetKey returns the alert definitions identifier
func (alertDefinition *AlertDefinition) GetKey() AlertDefinitionKey {
	return AlertDefinitionKey{OrgID: alertDefinition.OrgID, DefinitionUID: alertDefinition.UID}
}

// PreSave sets datasource and loads the updated model for each alert query.
func (alertDefinition *AlertDefinition) PreSave(timeNow func() time.Time) error {
	for i, q := range alertDefinition.Data {
		err := q.PreSave()
		if err != nil {
			return fmt.Errorf("invalid alert query %s: %w", q.RefID, err)
		}
		alertDefinition.Data[i] = q
	}
	alertDefinition.Updated = timeNow()
	return nil
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
	Data            []AlertQuery
	IntervalSeconds int64
}

// GetAlertDefinitionByUIDQuery is the query for retrieving/deleting an alert definition by UID and organisation ID.
type GetAlertDefinitionByUIDQuery struct {
	UID   string
	OrgID int64

	Result *AlertDefinition
}

// DeleteAlertDefinitionByUIDCommand is the command for deleting an alert definition
type DeleteAlertDefinitionByUIDCommand struct {
	UID   string
	OrgID int64
}

// SaveAlertDefinitionCommand is the query for saving a new alert definition.
type SaveAlertDefinitionCommand struct {
	Title           string       `json:"title"`
	OrgID           int64        `json:"-"`
	Condition       string       `json:"condition"`
	Data            []AlertQuery `json:"data"`
	IntervalSeconds *int64       `json:"intervalSeconds"`

	Result *AlertDefinition
}

// UpdateAlertDefinitionCommand is the query for updating an existing alert definition.
type UpdateAlertDefinitionCommand struct {
	Title           string       `json:"title"`
	OrgID           int64        `json:"-"`
	Condition       string       `json:"condition"`
	Data            []AlertQuery `json:"data"`
	IntervalSeconds *int64       `json:"intervalSeconds"`
	UID             string       `json:"-"`

	Result *AlertDefinition
}

// EvalAlertConditionCommand is the command for evaluating a condition
type EvalAlertConditionCommand struct {
	Condition string       `json:"condition"`
	Data      []AlertQuery `json:"data"`
	Now       time.Time    `json:"now"`
}

// ListAlertDefinitionsQuery is the query for listing alert definitions
type ListAlertDefinitionsQuery struct {
	OrgID int64 `json:"-"`

	Result []*AlertDefinition
}

// UpdateAlertDefinitionPausedCommand is the command for updating an alert definitions
type UpdateAlertDefinitionPausedCommand struct {
	OrgID  int64    `json:"-"`
	UIDs   []string `json:"uids"`
	Paused bool     `json:"-"`

	ResultCount int64
}

// Condition contains backend expressions and queries and the RefID
// of the query or expression that will be evaluated.
type Condition struct {
	// Condition is the RefID of the query or expression from
	// the Data property to get the results for.
	Condition string `json:"condition"`
	OrgID     int64  `json:"-"`

	// Data is an array of data source queries and/or server side expressions.
	Data []AlertQuery `json:"data"`
}

// IsValid checks the condition's validity.
func (c Condition) IsValid() bool {
	// TODO search for refIDs in QueriesAndExpressions
	return len(c.Data) != 0
}
