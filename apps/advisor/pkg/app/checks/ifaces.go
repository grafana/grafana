package checks

import (
	"context"

	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
)

// Check returns metadata about the check being executed and the list of Steps
type Check interface {
	ID() string
	Init(ctx context.Context) error
	Steps() []Step
	ItemsLen() int
}

// Step is a single step in a check, including its metadata
type Step interface {
	ID() string
	Title() string
	Description() string
	Run(ctx context.Context, obj *advisorv0alpha1.CheckSpec) ([]advisorv0alpha1.CheckReportError, error)
}
