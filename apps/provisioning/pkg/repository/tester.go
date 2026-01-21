package repository

import (
	"context"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// RepositoryTester validates repository configuration and runs health checks.
// It uses a Validator to validate the configuration before testing connectivity.
//
// This is primarily used by the health checker for reconcile health checks.
// For pre-admission testing (test endpoint), use AdmissionValidator.Validate() directly.
type RepositoryTester struct {
	validator Validator
}

// NewRepositoryTester creates a repository tester with the given validator.
// For health checks, pass a basic RepositoryValidator since the repository
// already passed admission validation when it was created/updated.
func NewRepositoryTester(validator Validator) RepositoryTester {
	return RepositoryTester{
		validator: validator,
	}
}

// Test validates the repository configuration and runs a health check.
// Validation errors are returned as TestResults, not as errors.
// Only internal errors (e.g., network failures during health check) return error.
func (t *RepositoryTester) Test(ctx context.Context, repo Repository) (*provisioning.TestResults, error) {
	cfg := repo.Config()

	errors := t.validator.Validate(ctx, cfg)
	if len(errors) > 0 {
		rsp := &provisioning.TestResults{
			Code:    http.StatusUnprocessableEntity,
			Success: false,
			Errors:  make([]provisioning.ErrorDetails, len(errors)),
		}
		for i, err := range errors {
			rsp.Errors[i] = provisioning.ErrorDetails{
				Type:   metav1.CauseType(err.Type),
				Field:  err.Field,
				Detail: err.Detail,
			}
		}
		return rsp, nil
	}

	return repo.Test(ctx)
}
