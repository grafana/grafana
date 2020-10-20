package ngalert

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/tsdb"
)

// AlertDefinition is the model for alert definitions in Alerting NG.
type AlertDefinition struct {
	Id        int64
	OrgId     int64
	Name      string
	Condition string
	Data      []tsdb.Query
}

var (
	// ErrAlertDefinitionNotFound is an error for an unknown alert definition.
	ErrAlertDefinitionNotFound = fmt.Errorf("could not find alert definition")
)

// GetAlertDefinitionByIDQuery is the query for retrieving/deleting an alert definition by ID.
type GetAlertDefinitionByIDQuery struct {
	ID    int64
	OrgID int64

	Result *AlertDefinition
}

type DeleteAlertDefinitionByIDQuery struct {
	ID    int64
	OrgID int64

	RowsAffected int64
}

// SaveAlertDefinitionCommand is the query for saving a new alert definition.
type SaveAlertDefinitionCommand struct {
	Name      string         `json:"name"`
	OrgID     int64          `json:"-"`
	Condition eval.Condition `json:"condition"`

	Result *AlertDefinition
}

// IsValid validates a SaveAlertDefinitionCommand.
// Returns always true.
func (cmd *SaveAlertDefinitionCommand) IsValid() bool {
	return true
}

// UpdateAlertDefinitionCommand is the query for updating an existing alert definition.
type UpdateAlertDefinitionCommand struct {
	ID        int64          `json:"-"`
	Name      string         `json:"name"`
	OrgID     int64          `json:"-"`
	Condition eval.Condition `json:"condition"`

	RowsAffected int64
	Result       *AlertDefinition
}

// IsValid validates a UpdateAlertDefinitionCommand.
// Returns always true.
func (cmd *UpdateAlertDefinitionCommand) IsValid() bool {
	return true
}

type EvalAlertConditionCommand struct {
	Condition eval.Condition `json:"condition"`
	Now       time.Time      `json:"now"`
}

type ListAlertDefinitionsCommand struct {
	OrgID int64 `json:"-"`

	Result []*AlertDefinition
}
