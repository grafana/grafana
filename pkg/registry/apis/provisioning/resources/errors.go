package resources

import (
	"errors"
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	foldermodel "github.com/grafana/grafana/pkg/services/folder"
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

// ErrFolderDepthExceeded is a sentinel for any depth-exceeded violation
// surfaced by the folder API, regardless of whether it came from a Create
// or an Update/move.
var ErrFolderDepthExceeded = errors.New("folder depth exceeded")

// Substrings used to recognise the two human-readable forms of the depth
// violation. They fall into two buckets that map onto the two validation
// paths in pkg/registry/apis/folders/validate.go:
//   - validateOnCreate returns a plain fmt.Errorf with "folder max depth exceeded"
//   - validateOnUpdate returns folder.ErrMaximumDepthReached, whose public
//     message is "Maximum nested folder depth reached"
//
// Both substrings have been stable for long enough that matching on them
// is the most reliable cross-process signal we have today; the structured
// message ID below is preferred when the error chain still carries it.
const (
	folderDepthExceededCreateMsg = "folder max depth exceeded"
	folderDepthExceededUpdateMsg = "maximum nested folder depth reached"

	// folderDepthExceededMessageID is the errutil message ID for the
	// move/update form. It survives the round-trip through the K8s API
	// inside Status.Details.UID, so it gives us a stable contract that
	// does not depend on the human-readable message.
	folderDepthExceededMessageID = "folder.maximum-depth-reached"
)

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

// ErrFolderManagedByOther is a sentinel for the cross-manager ownership
// conflict where the target folder is already managed by a different
// manager (another provisioning repo, a plugin, etc.). Provisioning cannot
// recover automatically and must not retry.
var ErrFolderManagedByOther = errors.New("folder managed by a different manager")

// FolderManagedByOtherError wraps the cross-manager ownership conflict so
// callers can detect it via errors.As.
type FolderManagedByOtherError struct {
	FolderID       string
	CurrentManager string
}

func (e *FolderManagedByOtherError) Error() string {
	return fmt.Sprintf("folder %q is already managed by %q", e.FolderID, e.CurrentManager)
}

func (e *FolderManagedByOtherError) Unwrap() []error {
	return []error{ErrFolderManagedByOther}
}

// NewFolderManagedByOtherError wraps a cross-manager folder-ownership conflict.
func NewFolderManagedByOtherError(folderID, currentManager string) *FolderManagedByOtherError {
	return &FolderManagedByOtherError{FolderID: folderID, CurrentManager: currentManager}
}

// IsFolderDepthExceededAPIError reports whether err originates from the
// folder API rejecting a write because the maximum folder depth was
// exceeded — either on Create (the new path is too deep) or on Update
// (a move would push the folder or its descendants past the limit).
func IsFolderDepthExceededAPIError(err error) bool {
	if err == nil {
		return false
	}

	// In-process: the original sentinel or the structured errutil base
	// error are still in the chain.
	if errors.Is(err, ErrFolderDepthExceeded) || errors.Is(err, foldermodel.ErrMaximumDepthReached) {
		return true
	}

	// Through the K8s API the structured message ID is propagated in
	// Status.Details.UID, which is the most reliable signal we get on
	// the client side.
	var statusErr apierrors.APIStatus
	if errors.As(err, &statusErr) {
		if details := statusErr.Status().Details; details != nil && string(details.UID) == folderDepthExceededMessageID {
			return true
		}
	}

	// Fallback: substring match on the known human-readable forms and on
	// the message ID itself, which appears in errutil.Error.Error() output
	// and therefore in any fmt.Errorf chain wrapping the in-process error.
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, folderDepthExceededCreateMsg) ||
		strings.Contains(msg, folderDepthExceededUpdateMsg) ||
		strings.Contains(msg, folderDepthExceededMessageID)
}
