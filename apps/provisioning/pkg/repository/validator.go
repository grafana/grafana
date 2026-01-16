package repository

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

type RepositoryValidator struct {
	allowedTargets      []provisioning.SyncTargetType
	allowImageRendering bool
	minSyncInterval     time.Duration
	repoFactory         Factory
}

// FIXME: The separation of concerns here is not ideal. RepositoryValidator should not depend on Factory,
// but we need to call Factory.Validate() for structural validation (URL, branch, path, etc.) before
// doing configuration validation. This coupling was introduced to avoid more extensive refactoring.
func NewValidator(minSyncInterval time.Duration, allowedTargets []provisioning.SyncTargetType, allowImageRendering bool, repoFactory Factory) RepositoryValidator {
	// do not allow minsync interval to be less than 10
	if minSyncInterval <= 10*time.Second {
		minSyncInterval = 10 * time.Second
	}

	return RepositoryValidator{
		allowedTargets:      allowedTargets,
		allowImageRendering: allowImageRendering,
		minSyncInterval:     minSyncInterval,
		repoFactory:         repoFactory,
	}
}

// ValidateRepository does structural validation (via Factory.Validate) and configuration checks on the repository object.
// It does not run a health check or compare against existing repositories.
// isCreate indicates whether this is a CREATE operation (true) or UPDATE operation (false).
// When isCreate is false, allowedTargets validation is skipped to allow existing repositories to continue working.
func (v *RepositoryValidator) ValidateRepository(ctx context.Context, cfg *provisioning.Repository, isCreate bool) field.ErrorList {
	var list field.ErrorList

	// FIXME: Structural validation (URL, branch, path, etc.) is done here via Factory.Validate().
	// This creates a coupling between RepositoryValidator and Factory that is not ideal from a separation
	// of concerns perspective, but avoids more extensive refactoring.
	list = append(list, v.repoFactory.Validate(ctx, cfg)...)
	if cfg.Spec.Title == "" {
		list = append(list, field.Required(field.NewPath("spec", "title"), "a repository title must be given"))
	}

	if cfg.Spec.Sync.Enabled {
		if cfg.Spec.Sync.Target == "" {
			list = append(list, field.Required(field.NewPath("spec", "sync", "target"),
				"The target type is required when sync is enabled"))
		} else if isCreate && !slices.Contains(v.allowedTargets, cfg.Spec.Sync.Target) {
			list = append(list,
				field.Invalid(
					field.NewPath("spec", "target"),
					cfg.Spec.Sync.Target,
					"sync target is not supported"))
		}

		if cfg.Spec.Sync.IntervalSeconds < int64(v.minSyncInterval.Seconds()) {
			list = append(list, field.Invalid(field.NewPath("spec", "sync", "intervalSeconds"),
				cfg.Spec.Sync.IntervalSeconds, fmt.Sprintf("Interval must be at least %d seconds", int64(v.minSyncInterval.Seconds()))))
		}
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

	if slices.Contains(cfg.Finalizers, RemoveOrphanResourcesFinalizer) &&
		slices.Contains(cfg.Finalizers, ReleaseOrphanResourcesFinalizer) {
		list = append(list,
			field.Invalid(
				field.NewPath("medatada", "finalizers"),
				cfg.Finalizers,
				"cannot have both remove and release orphan resources finalizers",
			),
		)
	}

	for _, f := range cfg.Finalizers {
		if !slices.Contains(SupportedFinalizers, f) {
			list = append(list,
				field.Invalid(
					field.NewPath("medatada", "finalizers"),
					cfg.Finalizers,
					fmt.Sprintf("unknown finalizer: %s", f),
				),
			)
		}
	}

	if !v.allowImageRendering && cfg.Spec.GitHub != nil && cfg.Spec.GitHub.GenerateDashboardPreviews {
		list = append(list,
			field.Invalid(field.NewPath("spec", "generateDashboardPreviews"),
				cfg.Spec.GitHub.GenerateDashboardPreviews,
				"image rendering is not enabled"))
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
