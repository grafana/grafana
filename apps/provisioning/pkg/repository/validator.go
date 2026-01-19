package repository

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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

// AdmissionValidator handles validation for Repository resources during admission
// Note: VerifyAgainstExistingRepositories type is defined in tester.go
type AdmissionValidator struct {
	validator                        RepositoryValidator
	verifyAgainstExistingRepositories VerifyAgainstExistingRepositories
}

// NewAdmissionValidator creates a new repository admission validator
func NewAdmissionValidator(validator RepositoryValidator, verifyFn VerifyAgainstExistingRepositories) *AdmissionValidator {
	return &AdmissionValidator{
		validator:                        validator,
		verifyAgainstExistingRepositories: verifyFn,
	}
}

// Validate validates Repository resources during admission
func (v *AdmissionValidator) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	obj := a.GetObject()
	if obj == nil {
		return nil
	}

	// Do not validate objects we are trying to delete
	meta, _ := utils.MetaAccessor(obj)
	if meta.GetDeletionTimestamp() != nil {
		return nil
	}

	r, ok := obj.(*provisioning.Repository)
	if !ok {
		return fmt.Errorf("expected repository configuration, got %T", obj)
	}

	// Copy previous values if they exist
	if a.GetOldObject() != nil {
		if oldRepo, ok := a.GetOldObject().(*provisioning.Repository); ok {
			CopySecureValues(r, oldRepo)
		}
	}

	// ALL configuration validations should be done in ValidateRepository -
	// this is how the UI is able to show proper validation errors
	//
	// the only time to add configuration checks here is if you need to compare
	// the incoming change to the current configuration
	isCreate := a.GetOperation() == admission.Create
	list := v.validator.ValidateRepository(ctx, r, isCreate)

	if a.GetOperation() == admission.Update {
		oldRepo := a.GetOldObject().(*provisioning.Repository)
		if r.Spec.Type != oldRepo.Spec.Type {
			list = append(list, field.Forbidden(field.NewPath("spec", "type"),
				"Changing repository type is not supported"))
		}

		// Do not allow changing the sync target once anything has synced successfully
		if r.Spec.Sync.Target != oldRepo.Spec.Sync.Target && len(oldRepo.Status.Stats) > 0 {
			list = append(list, field.Forbidden(field.NewPath("spec", "sync", "target"),
				"Changing sync target after running sync is not supported"))
		}
	}

	// Early exit to avoid more expensive checks if we have already found errors
	if len(list) > 0 {
		return invalidRepositoryError(a.GetName(), list)
	}

	// Verify against existing repositories
	if v.verifyAgainstExistingRepositories != nil {
		if targetError := v.verifyAgainstExistingRepositories(ctx, r); targetError != nil {
			return invalidRepositoryError(a.GetName(), field.ErrorList{targetError})
		}
	}

	return nil
}

func invalidRepositoryError(name string, list field.ErrorList) error {
	return apierrors.NewInvalid(
		provisioning.RepositoryResourceInfo.GroupVersionKind().GroupKind(),
		name, list)
}
