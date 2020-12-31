package librarypanels

import (
	"encoding/json"
	"errors"
	"time"
)

// LibraryPanel is the model for library panel definitions.
type LibraryPanel struct {
	ID       int64  `xorm:"pk autoincr 'id'"`
	OrgID    int64  `xorm:"org_id"`
	FolderID int64  `xorm:"folder_id"`
	UID      string `xorm:"uid"`
	Name     string
	Model    json.RawMessage

	Created time.Time
	Updated time.Time

	CreatedBy int64
	UpdatedBy int64
}

var (
	// errLibraryPanelAlreadyExists is an error for when the user tries to add a library panel that already exists.
	errLibraryPanelAlreadyExists = errors.New("library panel with that name already exists")
	// errLibraryPanelNotFound is an error for when a library panel can't be found.
	errLibraryPanelNotFound = errors.New("library panel could not be found")
)

// Commands

// createLibraryPanelCommand is the command for adding a LibraryPanel
type createLibraryPanelCommand struct {
	FolderID int64           `json:"folderId"`
	Name     string          `json:"name"`
	Model    json.RawMessage `json:"model"`
}

// patchLibraryPanelCommand is the command for patching a LibraryPanel
type patchLibraryPanelCommand struct {
	FolderID int64           `json:"folderId"`
	Name     string          `json:"name"`
	Model    json.RawMessage `json:"model"`
}
