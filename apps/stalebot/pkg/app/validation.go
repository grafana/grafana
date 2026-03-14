package app

import (
	"context"
	"errors"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
)

var _ simple.KindValidator = NewValidator()

// Validator implements simple.KindValidator
type Validator struct{}

// NewValidator creates a new validator for StaleDashboardTracker
func NewValidator() *Validator {
	return &Validator{}
}

// Validate validates a StaleDashboardTracker object
func (v *Validator) Validate(ctx context.Context, req *app.AdmissionRequest) error {
	// TODO: Add validation logic
	// - Validate dashboardUID is not empty
	// - Validate staleDaysThreshold is within bounds
	// - Validate notification channels if configured

	if req.Object.GetName() == "" {
		return errors.New("name cannot be empty")
	}

	return nil
}
