package checks

import (
	"context"

	"github.com/grafana/grafana-app-sdk/logging"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
)

// Check returns metadata about the check being executed and the list of Steps
type Check interface {
	// ID returns the unique identifier of the check
	ID() string
	// Item returns the item that will be checked
	Item(ctx context.Context, id string) (any, error)
	// Items returns the list of items that will be checked
	Items(ctx context.Context) ([]any, error)
	// Steps returns the list of steps that will be executed
	Steps() []Step
}

// Step is a single step in a check, including its metadata
type Step interface {
	// ID returns the unique identifier of the step
	ID() string
	// Title returns the title of the step
	Title() string
	// Description returns the description of the step
	Description() string
	// Explains the action that needs to be taken to resolve the issue
	Resolution() string
	// Run executes the step for an item and returns a report
	Run(ctx context.Context, log logging.Logger, obj *advisorv0alpha1.CheckSpec, item any) (*advisorv0alpha1.CheckReportFailure, error)
}
