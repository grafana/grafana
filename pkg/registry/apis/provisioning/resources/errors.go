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

// ErrFolderUIDTooLong is a sentinel for folder-API rejections caused by a
// UID exceeding the 40-character limit. Triggered by the typed error below
// or by the legacy "uid too long, max 40 characters" message form, which
// older Grafanas surface as a 500 (the structured 400 response was added in
// pkg/registry/apis/folders/errors.go, but provisioning may run against a
// Grafana that hasn't picked it up yet).
var ErrFolderUIDTooLong = errors.New("folder uid too long")

const (
	// folderUIDTooLongLegacyMsg is the message the dashboards.ErrDashboardUidTooLong
	// sentinel returns. Pre-fix grafanas surface it as the body of a 500;
	// post-fix grafanas surface it as the public message of a structured 400.
	folderUIDTooLongLegacyMsg = "uid too long, max 40 characters"

	// folderUIDTooLongMessageID is the errutil message ID set on
	// pkg/registry/apis/folders.ErrAPIUIDTooLong. It survives the round-trip
	// through the K8s API inside Status.Details.UID and through any fmt.Errorf
	// chain that retains err.Error().
	folderUIDTooLongMessageID = "folder.uid-too-long"
)

// FolderUIDTooLongError wraps a folder-API "uid too long" rejection. The
// repository owner must shorten the offending path or _folder.json UID;
// provisioning cannot recover automatically and must not retry the write.
type FolderUIDTooLongError struct {
	Path string
	UID  string
	Err  error
}

func (e *FolderUIDTooLongError) Error() string {
	if e.Err == nil {
		return fmt.Sprintf("folder UID %q at %q exceeds the 40-character limit enforced by the folder API", e.UID, e.Path)
	}
	return fmt.Sprintf("folder UID %q at %q exceeds the 40-character limit enforced by the folder API: %v", e.UID, e.Path, e.Err)
}

// Unwrap exposes both the sentinel and the underlying API error so callers
// can match either via errors.Is/errors.As.
func (e *FolderUIDTooLongError) Unwrap() []error {
	if e.Err == nil {
		return []error{ErrFolderUIDTooLong}
	}
	return []error{ErrFolderUIDTooLong, e.Err}
}

// NewFolderUIDTooLongError wraps the original folder-API error so callers
// can detect the UID-length violation via errors.As.
func NewFolderUIDTooLongError(path, uid string, err error) *FolderUIDTooLongError {
	return &FolderUIDTooLongError{Path: path, UID: uid, Err: err}
}

// IsFolderUIDTooLongAPIError reports whether err originates from the folder
// API rejecting a write because the UID exceeded the 40-character limit.
func IsFolderUIDTooLongAPIError(err error) bool {
	if err == nil {
		return false
	}

	// In-process: the sentinel is still in the chain.
	if errors.Is(err, ErrFolderUIDTooLong) {
		return true
	}

	// Through the K8s API the structured message ID is propagated in
	// Status.Details.UID, which is the most reliable signal we get on
	// the client side once pkg/registry/apis/folders.ErrAPIUIDTooLong has
	// rolled out.
	var statusErr apierrors.APIStatus
	if errors.As(err, &statusErr) {
		if details := statusErr.Status().Details; details != nil && string(details.UID) == folderUIDTooLongMessageID {
			return true
		}
	}

	// Fallback: substring match on the legacy human-readable form (which
	// appears in pre-fix 500 responses and in dashboards.ErrDashboardUidTooLong)
	// and on the structured message ID, which appears in errutil.Error.Error()
	// output and therefore in any fmt.Errorf chain wrapping the in-process error.
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, folderUIDTooLongLegacyMsg) ||
		strings.Contains(msg, folderUIDTooLongMessageID)
}

// folderValidationMessageIDs is the explicit allow-list of folder.* errutil
// message IDs that represent user-fixable validation rejections from the
// folder API. Errors with these IDs come from a user-controlled input
// (path, _folder.json, dashboard parent annotation) and re-running the
// sync without the user fixing the input will fail again — the warning
// classification is what stops the retry loop.
//
// We deliberately allow-list rather than match every "folder." prefix so
// internal-only errutil errors that happen to live in the folder package —
// notably folder.ErrBadRequest ("folder.bad-request"), raised on
// programmer faults like a missing signed-in user — are NOT silently
// downgraded to sync warnings. Those are real bugs that must surface as
// errors so they get noticed.
//
// When new user-fixable folder validations are added, extend this map.
// New folder.* errutil errors that are server-side faults must NOT be
// added here.
var folderValidationMessageIDs = map[string]struct{}{
	"folder.title-empty":                {},
	"folder.invalid-uid":                {},
	"folder.invalid-uid-chars":          {},
	"folder.uid-too-long":               {},
	"folder.cannot-be-parent-of-itself": {},
	"folder.maximum-depth-reached":      {},
	"folder.cannot-be-moved-to-k6":      {},
	"folder.name-exists":                {},
	"folder.circular-reference":         {},
}

// ErrFolderValidation is a sentinel for any user-actionable 4xx rejection
// from the folder API that does not match a more specific sentinel above
// (e.g. an invalid-uid-chars or reserved-uid rejection coming from a
// _folder.json UID the user controls). Like the depth and uid-too-long
// sentinels, it is surfaced as a job warning so the sync is not retried.
var ErrFolderValidation = errors.New("folder validation failed")

// FolderValidationError wraps a generic folder-API validation rejection.
// More specific wrappers — FolderDepthExceededError, FolderUIDTooLongError —
// take precedence in EnsureFolderExists; this type is the catch-all for any
// remaining folder-API 4xx that the sync cannot recover from automatically.
type FolderValidationError struct {
	Path string
	Err  error
}

func (e *FolderValidationError) Error() string {
	if e.Err == nil {
		return fmt.Sprintf("folder API rejected %q with a validation error", e.Path)
	}
	return fmt.Sprintf("folder API rejected %q with a validation error: %v", e.Path, e.Err)
}

// Unwrap exposes both the sentinel and the underlying API error so callers
// can match either via errors.Is/errors.As.
func (e *FolderValidationError) Unwrap() []error {
	if e.Err == nil {
		return []error{ErrFolderValidation}
	}
	return []error{ErrFolderValidation, e.Err}
}

// NewFolderValidationError wraps the original folder-API error so callers
// can detect the validation rejection via errors.As.
func NewFolderValidationError(path string, err error) *FolderValidationError {
	return &FolderValidationError{Path: path, Err: err}
}

// IsFolderValidationAPIError reports whether err is a 4xx rejection from the
// folder API caused by a user-fixable validation rule.
//
// It returns true for:
//   - any of the more specific sentinels (depth, uid-too-long), so callers
//     can use a single check when they don't care about the subtype;
//   - any K8s StatusError whose code is 400 and whose Details.UID is on
//     the folderValidationMessageIDs allow-list — covers every folder
//     errutil sentinel landed via #123709 / #123843 that represents a
//     user-fixable repository-side input problem;
//   - the in-process errutil.Error itself (it implements APIStatus and the
//     above branch matches it via errors.As).
//
// It does NOT match:
//   - 5xx errors (genuinely retryable transient failures);
//   - 4xx errors with a folder.* message ID that is NOT user-fixable
//     (e.g. folder.bad-request raised on programmer faults like a missing
//     signed-in user) — those must keep surfacing as hard errors;
//   - 4xx errors with no message ID at all (likely caller bugs we want to
//     keep visible so we can debug them);
//   - 401/403/404, where retry semantics differ and the existing
//     ResourceOwnershipConflictError / ResourceUnmanagedConflictError
//     paths handle the meaningful cases.
func IsFolderValidationAPIError(err error) bool {
	if err == nil {
		return false
	}

	if IsFolderDepthExceededAPIError(err) || IsFolderUIDTooLongAPIError(err) {
		return true
	}

	if errors.Is(err, ErrFolderValidation) {
		return true
	}

	// Structured 400 from a folder errutil error. errutil.Error implements
	// APIStatus, so errors.As matches both an in-process error and one that
	// has round-tripped through the K8s API as a *StatusError.
	var statusErr apierrors.APIStatus
	if errors.As(err, &statusErr) {
		s := statusErr.Status()
		if s.Code == 400 && s.Details != nil {
			if _, ok := folderValidationMessageIDs[string(s.Details.UID)]; ok {
				return true
			}
		}
	}

	return false
}
