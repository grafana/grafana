package repository

import (
	"context"
	"fmt"
	"net/http"
	"slices"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestRepository(ctx context.Context, repo Repository) (*provisioning.TestResults, error) {
	errors := ValidateRepository(repo)
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

func ValidateRepository(repo Repository) field.ErrorList {
	list := repo.Validate()
	cfg := repo.Config()

	if cfg.Spec.Title == "" {
		list = append(list, field.Required(field.NewPath("spec", "title"), "a repository title must be given"))
	}

	if cfg.Spec.Sync.Enabled && cfg.Spec.Sync.Target == "" {
		list = append(list, field.Required(field.NewPath("spec", "sync", "target"),
			"The target type is required when sync is enabled"))
	}

	if cfg.Spec.Sync.Enabled && cfg.Spec.Sync.IntervalSeconds < 10 {
		list = append(list, field.Invalid(field.NewPath("spec", "sync", "intervalSeconds"),
			cfg.Spec.Sync.IntervalSeconds, fmt.Sprintf("Interval must be at least %d seconds", 10)))
	}

	// Reserved names (for now)
	reserved := []string{"classic", "sql", "SQL", "plugins", "legacy", "new", "job", "github", "s3", "gcs", "file", "new", "create", "update", "delete"}
	if slices.Contains(reserved, cfg.Name) {
		list = append(list, field.Invalid(field.NewPath("metadata", "name"), cfg.Name, "Name is reserved, choose a different identifier"))
	}

	if cfg.Spec.Type != provisioning.LocalRepositoryType && cfg.Spec.Local != nil {
		list = append(list, field.Invalid(field.NewPath("spec", "local"),
			cfg.Spec.GitHub, "Local config only valid when type is local"))
	}

	if cfg.Spec.Type != provisioning.GitHubRepositoryType && cfg.Spec.GitHub != nil {
		list = append(list, field.Invalid(field.NewPath("spec", "github"),
			cfg.Spec.GitHub, "Github config only valid when type is github"))
	}

	if cfg.Spec.Type != provisioning.GitRepositoryType && cfg.Spec.Git != nil {
		list = append(list, field.Invalid(field.NewPath("spec", "git"),
			cfg.Spec.Git, "Git config only valid when type is git"))
	}

	for _, w := range cfg.Spec.Workflows {
		switch w {
		case provisioning.WriteWorkflow: // valid; no fall thru
		case provisioning.BranchWorkflow:
			if !cfg.Spec.Type.IsGit() {
				list = append(list, field.Invalid(field.NewPath("spec", "workflow"), w, "branch is only supported on git repositories"))
			}
		default:
			list = append(list, field.Invalid(field.NewPath("spec", "workflow"), w, "invalid workflow"))
		}
	}

	return list
}

func FromFieldError(err *field.Error) *provisioning.TestResults {
	return &provisioning.TestResults{
		Code:    http.StatusBadRequest,
		Success: false,
		Errors: []provisioning.ErrorDetails{{
			Type:   metav1.CauseType(err.Type),
			Field:  err.Field,
			Detail: err.Detail,
		}},
	}
}
