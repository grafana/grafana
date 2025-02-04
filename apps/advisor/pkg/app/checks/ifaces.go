package checks

import (
	"context"

	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
)

// Check returns metadata about the check being executed and the list of Steps
type Check interface {
	// ID returns the unique identifier of the check
	ID() string
	// Init is executed before Steps or ItemsLen are called and should be used
	// to store any shared state or perform any initialization
	Init(ctx context.Context) error
	// Steps returns the list of steps that will be executed for
	Steps() []Step
	// ItemsLen returns the number of items that will be checked
	ItemsLen() int
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
	Run(ctx context.Context, obj *advisorv0alpha1.CheckSpec) ([]advisorv0alpha1.CheckReportError, error)
}
