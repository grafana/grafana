package librarypanels

import (
	"encoding/json"
	"errors"
	"time"
)

// LibraryPanel is the model for library panel definitions.
type LibraryPanel struct {
	ID       int64 `xorm:"pk autoincr 'id'"`
	OrgID    int64 `xorm:"org_id"`
	FolderID int64 `xorm:"folder_id"`
	Title    string
	Model    json.RawMessage

	Created time.Time
	Updated time.Time

	CreatedBy int64
	UpdatedBy int64
}

var (
	// errLibraryPanelAlreadyAdded is an error for when the user tries to add a library panel that already exists.
	errLibraryPanelAlreadyAdded = errors.New("library panel with that title already exists")
	// errLibraryPanelNotFound is an error for when a library panel can't be found.
	errLibraryPanelNotFound = errors.New("library panel could not be found")
)

// Commands

// addLibraryPanelCommand is the command for adding a LibraryPanel
type addLibraryPanelCommand struct {
	FolderID int64           `json:"folderId"`
	Title    string          `json:"title"`
	Model    json.RawMessage `json:"model"`
}
