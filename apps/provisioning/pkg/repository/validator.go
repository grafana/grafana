package repository

import (
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
}

func NewValidator(minSyncInterval time.Duration, allowedTargets []provisioning.SyncTargetType, allowImageRendering bool) RepositoryValidator {
	// do not allow minsync interval to be less than 10
	if minSyncInterval <= 10*time.Second {
		minSyncInterval = 10 * time.Second
	}

	return RepositoryValidator{
		allowedTargets:      allowedTargets,
		allowImageRendering: allowImageRendering,
		minSyncInterval:     minSyncInterval,
	}
}

// ValidateRepository solely does configuration checks on the repository object. It does not run a health check or compare against existing repositories.
func (v *RepositoryValidator) ValidateRepository(repo Repository) field.ErrorList {
	list := repo.Validate()
	cfg := repo.Config()

	if cfg.Spec.Title == "" {
		list = append(list, field.Required(field.NewPath("spec", "title"), "a repository title must be given"))
	}

	if cfg.Spec.Sync.Enabled {
		if cfg.Spec.Sync.Target == "" {
			list = append(list, field.Required(field.NewPath("spec", "sync", "target"),
				"The target type is required when sync is enabled"))
		} else if !slices.Contains(v.allowedTargets, cfg.Spec.Sync.Target) {
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
