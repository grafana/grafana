package checks

import (
	"context"

	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
)

// Check returns metadata about the check being executed and the list of Steps
type Check interface {
	// ID returns the unique identifier of the check
	ID() string
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
	// Run executes the step and returns a list of errors
	Run(ctx context.Context, obj *advisorv0alpha1.CheckSpec, items []any) ([]advisorv0alpha1.CheckReportError, error)
}
