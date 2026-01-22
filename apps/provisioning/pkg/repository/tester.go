package repository

import (
	"context"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// Tester validates repository configuration and runs health checks.
// It uses Validators to validate the configuration before testing connectivity.
//
// This is used by both:
// - Health checker for reconcile health checks (with basic RepositoryValidator)
// - Test endpoint for pre-admission testing (with RepositoryValidator + ExistingRepositoriesValidator)
type Tester struct {
	validators []Validator
}

// NewTester creates a repository tester with the given validators.
// Validators are run in order; the first to return errors stops validation.
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
			rsp := &provisioning.TestResults{
				Code:    http.StatusUnprocessableEntity,
				Success: false,
				Errors:  make([]provisioning.ErrorDetails, len(list)),
			}
			for i, err := range list {
				rsp.Errors[i] = provisioning.ErrorDetails{
					Type:   metav1.CauseType(err.Type),
					Field:  err.Field,
					Detail: err.Detail,
				}
			}
			return rsp, nil
		}
	}

	return repo.Test(ctx)
}
