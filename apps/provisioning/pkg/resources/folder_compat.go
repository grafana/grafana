package resources

import (
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

// The folder service lives in the main Grafana module, which this package must
// not import. These mirror the parts of its model that provisioning relies on;
// the provisioning API package tests that they stay in step with it.

const (
	// GeneralFolderUID is the canonical UID of the root folder.
	GeneralFolderUID = "general"
	// legacyRootFolderUID is the empty-string root sentinel that older API
	// responses and stored resources still carry.
	legacyRootFolderUID = ""

	// FolderVersionMismatchMessage is the message of the folder service's
	// version-mismatch error. That error is a plain errors.New, so callers can
	// only recognise it by its text.
	FolderVersionMismatchMessage = "the folder has been changed by someone else"
)

var (
	// ErrFolderMaximumDepthReached matches the folder service's
	// maximum-depth error under errors.Is, which compares reason and message ID.
	ErrFolderMaximumDepthReached = errutil.BadRequest(folderDepthExceededMessageID)
	// ErrFolderNotEmpty matches the folder service's not-empty error under
	// errors.Is.
	ErrFolderNotEmpty = errutil.BadRequest(folderNotEmptyMessageID)
)

const folderNotEmptyMessageID = "folder.not-empty"

// ToLegacyFolderUID maps the canonical root UID to the empty-string root that
// legacy API responses use, and returns every other UID unchanged.
func ToLegacyFolderUID(uid string) string {
	if uid == GeneralFolderUID {
		return legacyRootFolderUID
	}
	return uid
}

// IsRootFolderUID reports whether uid is either root sentinel.
func IsRootFolderUID(uid string) bool {
	return uid == legacyRootFolderUID || uid == GeneralFolderUID
}
