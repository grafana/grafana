package resources

import (
	"errors"
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// ResourceOwnershipConflictError represents an error that occurred when a resource
// is owned by a different repository or manager and cannot be modified.
type ResourceOwnershipConflictError struct {
	Err error
}

// Error implements the error interface
func (e *ResourceOwnershipConflictError) Error() string {
	if e.Err != nil {
		return e.Err.Error()
	}
	return "resource ownership conflict"
}

// Unwrap implements error unwrapping to support errors.Is and errors.As
func (e *ResourceOwnershipConflictError) Unwrap() error {
	return e.Err
}

// NewResourceOwnershipConflictError creates a BadRequest error for when a resource
// is owned by a different repository or manager and cannot be modified
func NewResourceOwnershipConflictError(resourceName string, currentManager utils.ManagerProperties, requestingManager utils.ManagerProperties) error {
	message := fmt.Sprintf("resource '%s' is managed by %s '%s' and cannot be modified by %s '%s'",
		resourceName,
		currentManager.Kind,
		currentManager.Identity,
		requestingManager.Kind,
		requestingManager.Identity)

	return &ResourceOwnershipConflictError{
		Err: apierrors.NewBadRequest(message),
	}
}

// ResourceUnmanagedConflictError represents an error when a sync would overwrite
// an existing unmanaged resource that was not explicitly allowed for takeover.
type ResourceUnmanagedConflictError struct {
	Err error
}

func (e *ResourceUnmanagedConflictError) Error() string {
	if e.Err != nil {
		return e.Err.Error()
	}
	return "resource unmanaged conflict"
}

func (e *ResourceUnmanagedConflictError) Unwrap() error {
	return e.Err
}

// NewResourceUnmanagedConflictError creates a BadRequest error for when a sync
// would overwrite an existing unmanaged resource.
func NewResourceUnmanagedConflictError(resourceName string, requestingManager utils.ManagerProperties) error {
	message := fmt.Sprintf(
		"resource '%s' already exists and is not managed; %s '%s' cannot take over without an explicit migration",
		resourceName,
		requestingManager.Kind,
		requestingManager.Identity,
	)
	return &ResourceUnmanagedConflictError{
		Err: apierrors.NewBadRequest(message),
	}
}

// ResourceValidationError represents an error that occurred while validating a resource.
type ResourceValidationError struct {
	Err error
}

// Error implements the error interface
func (e *ResourceValidationError) Error() string {
	base := "resource validation failed"
	if e.Err == nil {
		return base
	}

	// Default to the underlying error string
	messageErr := e.Err

	// If it's a multi-error that exposes Unwrap() []error, use the first error if existing
	if multi, ok := e.Err.(interface{ Unwrap() []error }); ok {
		unwrapped := multi.Unwrap()
		if len(unwrapped) > 0 && unwrapped[0] != nil {
			messageErr = unwrapped[0]
		}
	}

	return fmt.Sprintf("%s: %s", base, messageErr.Error())
}

// Unwrap implements error unwrapping to support errors.Is and errors.As
func (e *ResourceValidationError) Unwrap() []error {
	if e.Err == nil {
		return []error{}
	}

	if multi, ok := e.Err.(interface{ Unwrap() []error }); ok {
		// keep the existing multi-error children
		return multi.Unwrap()
	}
	// single child
	return []error{e.Err}
}

// NewResourceValidationError creates a new ResourceError for validation failures.
// This error will be translated to a BadRequest error by the API layer.
func NewResourceValidationError(err error) *ResourceValidationError {
	message := "resource validation failed"
	var combinedError error = nil

	if err != nil {
		message = fmt.Sprintf("%s: %v", message, err)
		combinedError = errors.Join(err, apierrors.NewBadRequest(message))
	}

	return &ResourceValidationError{
		Err: combinedError,
	}
}

const folderDepthExceededMessage = "folder max depth exceeded"

// ErrFolderDepthExceeded is a sentinel error.
var ErrFolderDepthExceeded = errors.New(folderDepthExceededMessage)

// FolderDepthExceededError wraps a folder-API depth violation.
type FolderDepthExceededError struct {
	Path string
	Err  error
}

func (e *FolderDepthExceededError) Error() string {
	if e.Err == nil {
		return fmt.Sprintf("folder %q exceeds the maximum folder depth allowed by the folder API", e.Path)
	}
	return fmt.Sprintf("folder %q exceeds the maximum folder depth allowed by the folder API: %v", e.Path, e.Err)
}

// Unwrap exposes both the sentinel and the underlying API error
func (e *FolderDepthExceededError) Unwrap() []error {
	if e.Err == nil {
		return []error{ErrFolderDepthExceeded}
	}
	return []error{ErrFolderDepthExceeded, e.Err}
}

// NewFolderDepthExceededError wraps the original folder-API error so callers
// can detect the depth violation via errors.As.
func NewFolderDepthExceededError(path string, err error) *FolderDepthExceededError {
	return &FolderDepthExceededError{Path: path, Err: err}
}

// IsFolderDepthExceededAPIError reports whether err originates from the
// folder API rejecting a write because the maximum folder depth was
// exceeded.
func IsFolderDepthExceededAPIError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, ErrFolderDepthExceeded) {
		return true
	}
	return strings.Contains(err.Error(), folderDepthExceededMessage)
}
