package checks

import (
	"context"

	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
)

// Check defines the methods that a check must implement to be executed.
type Check interface {
	Run(ctx context.Context, obj *advisorv0alpha1.CheckSpec) (*advisorv0alpha1.CheckV0alpha1StatusReport, error)
	Type() string
}
