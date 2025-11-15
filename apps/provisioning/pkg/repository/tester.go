package repository

import (
	"context"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// SimpleRepositoryTester will validate the repository configuration, and then proceed to test the connection to the repository
type SimpleRepositoryTester struct {
	validator RepositoryValidator
}

func NewSimpleRepositoryTester(validator RepositoryValidator) SimpleRepositoryTester {
	return SimpleRepositoryTester{
		validator: validator,
	}
}

// TestRepository validates the repository and then runs a health check
func (t *SimpleRepositoryTester) TestRepository(ctx context.Context, repo Repository) (*provisioning.TestResults, error) {
	errors := t.validator.ValidateRepository(repo)
	if len(errors) > 0 {
		rsp := &provisioning.TestResults{
			Code:    http.StatusUnprocessableEntity, // Invalid
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

type VerifyAgainstExistingRepositories func(ctx context.Context, cfg *provisioning.Repository) *field.Error // defined this way to prevent an import cycle

// RepositoryTesterWithExistingChecker will validate the repository configuration, run a health check, and then compare it against existing repositories
type RepositoryTesterWithExistingChecker struct {
	tester SimpleRepositoryTester
	verify VerifyAgainstExistingRepositories
}

func NewRepositoryTesterWithExistingChecker(tester SimpleRepositoryTester, verify VerifyAgainstExistingRepositories) RepositoryTesterWithExistingChecker {
	return RepositoryTesterWithExistingChecker{
		tester: tester,
		verify: verify,
	}
}

// TestRepositoryAndCheckExisting validates the repository, runs a health check, and then compares it against existing repositories
func (c *RepositoryTesterWithExistingChecker) TestRepositoryAndCheckExisting(ctx context.Context, repo Repository) (*provisioning.TestResults, error) {
	rsp, err := c.tester.TestRepository(ctx, repo)
	if err != nil {
		return nil, err
	}

	if rsp.Success {
		cfg := repo.Config()
		if validationErr := c.verify(ctx, cfg); validationErr != nil {
			rsp = &provisioning.TestResults{
				Success: false,
				Code:    http.StatusUnprocessableEntity,
				Errors: []provisioning.ErrorDetails{{
					Type:   metav1.CauseType(validationErr.Type),
					Field:  validationErr.Field,
					Detail: validationErr.Detail,
				}},
			}
		}
	}

	return rsp, nil
}
