package jobs

import (
	"errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// ResourceOutcome describes whether a resource operation succeeded, produced
// a non-fatal warning, or failed with an error.
type ResourceOutcome string

const (
	// OutcomeSuccess indicates the operation completed without issues.
	OutcomeSuccess ResourceOutcome = "success"
	// OutcomeWarning indicates the operation completed but with a non-fatal issue
	// (e.g. missing folder metadata, quota exceeded).
	OutcomeWarning ResourceOutcome = "warning"
	// OutcomeError indicates the operation failed.
	OutcomeError ResourceOutcome = "error"
)

// ResourceOperation describes the type of action performed on a resource
// during a provisioning job. Values align with repository.FileAction where
// applicable.
type ResourceOperation string

const (
	// OperationCreated indicates a new resource was created.
	OperationCreated ResourceOperation = "created"
	// OperationUpdated indicates an existing resource was modified.
	OperationUpdated ResourceOperation = "updated"
	// OperationDeleted indicates a resource was removed.
	OperationDeleted ResourceOperation = "deleted"
	// OperationRenamed indicates a resource was moved or renamed.
	OperationRenamed ResourceOperation = "renamed"
	// OperationIgnored indicates the resource was skipped (no change needed).
	OperationIgnored ResourceOperation = "ignored"
	// OperationReplaced indicates a resource was replaced (e.g. folder metadata
	// UID migration from path-based to metadata-based).
	OperationReplaced ResourceOperation = "replaced"
)

// classifyWarning returns the warning reason for err and whether it is a warning.
func classifyWarning(err error) (string, bool) {
	if err == nil {
		return "", false
	}

	var validationErr *resources.ResourceValidationError
	var ownershipErr *resources.ResourceOwnershipConflictError
	var unmanagedErr *resources.ResourceUnmanagedConflictError
	var quotaExceededErr *quotas.QuotaExceededError
	var missingMetaErr *resources.MissingFolderMetadata
	var metaConflictErr *resources.FolderMetadataConflict
	var invalidMetaErr *resources.InvalidFolderMetadata
	var depthExceededErr *resources.FolderDepthExceededError
	var uidTooLongErr *resources.FolderUIDTooLongError
	var folderValidationErr *resources.FolderValidationError

	// Order matters: the more specific folder reasons must be checked
	// before the generic FolderValidationError fallback so the user-facing
	// reason stays as descriptive as possible.
	switch {
	case errors.As(err, &quotaExceededErr):
		return provisioning.ReasonQuotaExceeded, true
	case errors.As(err, &validationErr):
		return provisioning.ReasonResourceInvalid, true
	case errors.As(err, &ownershipErr):
		return provisioning.ReasonResourceInvalid, true
	case errors.As(err, &unmanagedErr):
		return provisioning.ReasonResourceInvalid, true
	case errors.As(err, &missingMetaErr):
		return provisioning.ReasonMissingFolderMetadata, true
	case errors.As(err, &metaConflictErr):
		return provisioning.ReasonFolderMetadataConflict, true
	case errors.As(err, &invalidMetaErr):
		return provisioning.ReasonInvalidFolderMetadata, true
	case errors.As(err, &depthExceededErr):
		return provisioning.ReasonFolderDepthExceeded, true
	case errors.As(err, &uidTooLongErr):
		return provisioning.ReasonFolderUIDTooLong, true
	case errors.As(err, &folderValidationErr):
		return provisioning.ReasonFolderValidationFailed, true
	default:
		return "", false
	}
}

// isWarningError checks if the given error should be treated as a warning.
func isWarningError(err error) bool {
	_, ok := classifyWarning(err)
	return ok
}

// isNonFailingWarning reports whether the warning represents an informational
// issue where the underlying resource operation still succeeded (e.g. missing
// or invalid folder metadata).
func isNonFailingWarning(err error) bool {
	if err == nil {
		return false
	}
	return errors.Is(err, resources.ErrMissingFolderMetadata) ||
		errors.Is(err, resources.ErrInvalidFolderMetadata)
}

// JobResourceResult represents the result of a resource operation in a job.
type JobResourceResult struct {
	name         string
	group        string
	kind         string
	path         string
	previousPath string
	action       repository.FileAction
	reason       string // explicit reason, takes precedence over classifyWarning
	err          error
	warning      error
}

// jobResourceResultBuilder is a builder for creating JobResourceResult instances using a fluent API.
type jobResourceResultBuilder struct {
	result JobResourceResult
}

// NewResourceResult creates a new builder for JobResourceResult.
func NewResourceResult() *jobResourceResultBuilder {
	return &jobResourceResultBuilder{
		result: JobResourceResult{},
	}
}

// NewPathOnlyResult creates a new builder with the path already set.
// This is used for operations that cannot be references to a Grafana resource or when the resource is not yet known.
func NewPathOnlyResult(path string) *jobResourceResultBuilder {
	return NewResourceResult().WithPath(path)
}

func NewGroupKindResult(name string, group, kind string) *jobResourceResultBuilder {
	return NewResourceResult().
		WithName(name).
		WithGroup(group).
		WithKind(kind)
}

func NewGVKResult(name string, gvk schema.GroupVersionKind) *jobResourceResultBuilder {
	return NewResourceResult().
		WithName(name).
		WithGVK(gvk)
}

func NewFolderResult(name string) *jobResourceResultBuilder {
	return NewResourceResult().
		WithPath(name).
		WithGroup(resources.FolderResource.Group).
		WithKind(resources.FolderKind.Kind)
}

// WithName sets the name of the resource.
func (b *jobResourceResultBuilder) WithName(name string) *jobResourceResultBuilder {
	b.result.name = name
	return b
}

// WithGroup sets the group of the resource.
func (b *jobResourceResultBuilder) WithGroup(group string) *jobResourceResultBuilder {
	b.result.group = group
	return b
}

// WithKind sets the kind of the resource.
func (b *jobResourceResultBuilder) WithKind(kind string) *jobResourceResultBuilder {
	b.result.kind = kind
	return b
}

// WithGVK sets the group and kind of the resource.
func (b *jobResourceResultBuilder) WithGVK(gvk schema.GroupVersionKind) *jobResourceResultBuilder {
	b.result.group = gvk.Group
	b.result.kind = gvk.Kind
	return b
}

// WithGKR sets the name, group, and kind of the resource in one call.
// This is a convenience method for setting Group/Kind/Resource information together.
func (b *jobResourceResultBuilder) WithGKR(name, group, kind string) *jobResourceResultBuilder {
	b.result.name = name
	b.result.group = group
	b.result.kind = kind
	return b
}

// WithPath sets the path of the resource.
func (b *jobResourceResultBuilder) WithPath(path string) *jobResourceResultBuilder {
	b.result.path = path
	return b
}

// WithPreviousPath sets the source path for rename operations.
// When a rename fails the resource stays at the previous (source) path,
// so safety checks need both paths to prevent premature folder deletion.
func (b *jobResourceResultBuilder) WithPreviousPath(path string) *jobResourceResultBuilder {
	b.result.previousPath = path
	return b
}

// WithAction sets the action performed on the resource.
func (b *jobResourceResultBuilder) WithAction(action repository.FileAction) *jobResourceResultBuilder {
	b.result.action = action
	return b
}

// WithReason sets an explicit reason on the result. This takes precedence over
// the reason derived from classifyWarning and can be used on success results
// to explain why an operation happened (e.g., UID migration).
func (b *jobResourceResultBuilder) WithReason(reason string) *jobResourceResultBuilder {
	b.result.reason = reason
	return b
}

// WithError sets the error associated with the resource operation.
// If the error is classified as a warning error, it will be set as a warning instead of an error.
// TODO: we should probably move the warning checks to the caller,
// and have a clear separation between WithError and WithWarning
func (b *jobResourceResultBuilder) WithError(err error) *jobResourceResultBuilder {
	if err != nil && isWarningError(err) {
		b.result.warning = err
		b.result.err = nil
	} else {
		b.result.err = err
		b.result.warning = nil
	}
	return b
}

// WithWarning explicitly sets the error associated with the resource operation as a warning.
func (b *jobResourceResultBuilder) WithWarning(err error) *jobResourceResultBuilder {
	if err != nil {
		b.result.warning = err
	}

	return b
}

// AsSkipped marks the resource as skipped by setting the action to Ignored and converting the error to a warning.
func (b *jobResourceResultBuilder) AsSkipped() *jobResourceResultBuilder {
	b.result.action = repository.FileActionIgnored
	if b.result.err != nil {
		b.result.warning = b.result.err
		b.result.err = nil
	}
	return b
}

// Build returns the final JobResourceResult.
func (b *jobResourceResultBuilder) Build() JobResourceResult {
	return b.result
}

// Name returns the name of the resource.
func (r JobResourceResult) Name() string {
	return r.name
}

// Group returns the group of the resource.
func (r JobResourceResult) Group() string {
	return r.group
}

// Kind returns the kind of the resource.
func (r JobResourceResult) Kind() string {
	return r.kind
}

// Path returns the path of the resource.
func (r JobResourceResult) Path() string {
	return r.path
}

// PreviousPath returns the source path for rename operations.
func (r JobResourceResult) PreviousPath() string {
	return r.previousPath
}

// Action returns the action performed on the resource.
func (r JobResourceResult) Action() repository.FileAction {
	return r.action
}

// Error returns the error associated with the resource operation.
func (r JobResourceResult) Error() error {
	return r.err
}

// Warning returns the warning associated with the resource operation.
func (r JobResourceResult) Warning() error {
	return r.warning
}

// Reason returns the explicit reason set via WithReason, or "" if none.
func (r JobResourceResult) Reason() string {
	return r.reason
}

// WarningReason returns the warning reason derived from classifyWarning,
// or the explicit reason if set via WithReason.
func (r JobResourceResult) WarningReason() string {
	if r.reason != "" {
		return r.reason
	}
	reason, _ := classifyWarning(r.warning)
	return reason
}
