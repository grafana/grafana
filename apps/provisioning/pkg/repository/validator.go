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

// Validator is the interface for repository validation.
// It validates repository configuration without requiring external service calls.
type Validator interface {
	// ValidateRepository validates the repository configuration.
	// isCreate indicates whether this is a CREATE (true) or UPDATE (false) operation.
	ValidateRepository(ctx context.Context, cfg *provisioning.Repository, isCreate bool) field.ErrorList
}

// RepositoryValidator implements Validator for basic repository configuration checks.
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

// AdmissionValidator handles validation for Repository resources during admission.
//
// Validation during admission is limited to structural checks that do not require
// decrypting secrets or calling external services (e.g., Git hosting APIs). This ensures
// fast, synchronous validation without side effects.
//
// For runtime validation that requires secrets or external service checks, use the
// Test() method on the Repository interface instead.
//
// AdmissionValidator wraps a Validator and adds additional validators
// (e.g., ExistingRepositoriesValidator) that compare against other repositories.
type AdmissionValidator struct {
	validator            Validator
	additionalValidators []ExistingRepositoriesValidator
}

// NewAdmissionValidator creates a new repository admission validator.
// additionalValidators are called after basic validation passes (e.g., ExistingRepositoriesValidator).
func NewAdmissionValidator(validator Validator, additionalValidators ...ExistingRepositoriesValidator) *AdmissionValidator {
	return &AdmissionValidator{
		validator:            validator,
		additionalValidators: additionalValidators,
	}
}

// Validate validates Repository resources during admission.
// This method is called by the admission webhook and performs additional checks
// that are specific to admission (e.g., comparing old vs new objects).
//
// The returned error is an apierrors.StatusError containing field.ErrorList when
// validation fails. Callers can use apierrors.StatusError to extract the field errors.
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

	isCreate := a.GetOperation() == admission.Create

	// Admission-specific checks that compare old vs new objects
	// These cannot be done in ValidateRepository because they need the old object
	var list field.ErrorList
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

	// Early exit if admission-specific checks failed
	if len(list) > 0 {
		return invalidRepositoryError(a.GetName(), list)
	}

	// Run base validation
	list = v.validator.ValidateRepository(ctx, r, isCreate)
	if len(list) > 0 {
		return invalidRepositoryError(a.GetName(), list)
	}

	// Run additional validators (e.g., existing repositories check)
	for _, validator := range v.additionalValidators {
		if validator == nil {
			continue
		}
		if err := validator.Validate(ctx, r); err != nil {
			return invalidRepositoryError(a.GetName(), field.ErrorList{err})
		}
	}

	return nil
}

func invalidRepositoryError(name string, list field.ErrorList) error {
	return apierrors.NewInvalid(
		provisioning.RepositoryResourceInfo.GroupVersionKind().GroupKind(),
		name, list)
}

// NewCreateAttributes creates admission.Attributes for a CREATE operation.
// This is useful for pre-admission validation (e.g., test endpoint).
func NewCreateAttributes(repo *provisioning.Repository) admission.Attributes {
	return admission.NewAttributesRecord(
		repo,
		nil, // old object
		provisioning.RepositoryResourceInfo.GroupVersionKind(),
		repo.GetNamespace(),
		repo.GetName(),
		provisioning.RepositoryResourceInfo.GroupVersionResource(),
		"",
		admission.Create,
		nil,
		false,
		nil, // user info not needed for validation
	)
}

// NewUpdateAttributes creates admission.Attributes for an UPDATE operation.
// This is useful for pre-admission validation (e.g., test endpoint).
func NewUpdateAttributes(repo, oldRepo *provisioning.Repository) admission.Attributes {
	return admission.NewAttributesRecord(
		repo,
		oldRepo,
		provisioning.RepositoryResourceInfo.GroupVersionKind(),
		repo.GetNamespace(),
		repo.GetName(),
		provisioning.RepositoryResourceInfo.GroupVersionResource(),
		"",
		admission.Update,
		nil,
		false,
		nil, // user info not needed for validation
	)
}
