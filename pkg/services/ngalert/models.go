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
	Data      []AlertQuery
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

// Condition is the structure used by storing/updating alert definition commmands
type Condition struct {
	RefID string `json:"refId"`

	QueriesAndExpressions []AlertQuery `json:"queriesAndExpressions"`
}

// SaveAlertDefinitionCommand is the query for saving a new alert definition.
type SaveAlertDefinitionCommand struct {
	Name         string               `json:"name"`
	OrgID        int64                `json:"-"`
	Condition    Condition            `json:"condition"`
	SignedInUser *models.SignedInUser `json:"-"`
	SkipCache    bool                 `json:"-"`

	Result *AlertDefinition
}

// IsValid validates a SaveAlertDefinitionCommand.
// Always returns true.
func (cmd *SaveAlertDefinitionCommand) IsValid() bool {
	return true
}

// UpdateAlertDefinitionCommand is the query for updating an existing alert definition.
type UpdateAlertDefinitionCommand struct {
	ID           int64                `json:"-"`
	Name         string               `json:"name"`
	OrgID        int64                `json:"-"`
	Condition    Condition            `json:"condition"`
	SignedInUser *models.SignedInUser `json:"-"`
	SkipCache    bool                 `json:"-"`

	RowsAffected int64
	Result       *AlertDefinition
}

// IsValid validates a UpdateAlertDefinitionCommand.
// Always returns true.
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
