package repository

import (
	"context"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// Tester validates repository configuration and runs health checks.
// It uses a Validator to validate the configuration before testing connectivity.
//
// This is primarily used by the health checker for reconcile health checks.
// For pre-admission testing (test endpoint), use AdmissionValidator.Validate() directly.
type Tester struct {
	validators []Validator
}

// NewTester creates a repository tester with the given validator.
// For health checks, pass a basic RepositoryValidator since the repository
// already passed admission validation when it was created/updated.
func NewTester(validators ...Validator) Tester {
	return Tester{
		validators: validators,
	}
}

// Test validates the repository configuration and runs a health check.
// Validation errors are returned as TestResults, not as errors.
// Only internal errors (e.g., network failures during health check) return error.
func (t *Tester) Test(ctx context.Context, repo Repository) (*provisioning.TestResults, error) {
	cfg := repo.Config()

	for _, validator := range t.validators {
		list := validator.Validate(ctx, cfg)
		if len(list) > 0 {
			return nil, invalidRepositoryError(cfg.GetName(), list)
		}
	}

	return repo.Test(ctx)
}
