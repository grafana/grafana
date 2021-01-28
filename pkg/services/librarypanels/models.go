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

// LibraryPanelWithMeta is the model used to retrieve library panels with additional meta information.
type LibraryPanelWithMeta struct {
	ID       int64  `xorm:"pk autoincr 'id'"`
	OrgID    int64  `xorm:"org_id"`
	FolderID int64  `xorm:"folder_id"`
	UID      string `xorm:"uid"`
	Name     string
	Model    json.RawMessage

	Created time.Time
	Updated time.Time

	CanEdit        bool
	CreatedBy      int64
	UpdatedBy      int64
	CreatedByName  string
	CreatedByEmail string
	UpdatedByName  string
	UpdatedByEmail string
}

// LibraryPanelDTO is the frontend DTO for library panels.
type LibraryPanelDTO struct {
	ID       int64               `json:"id"`
	OrgID    int64               `json:"orgId"`
	FolderID int64               `json:"folderId"`
	UID      string              `json:"uid"`
	Name     string              `json:"name"`
	Model    json.RawMessage     `json:"model"`
	Meta     LibraryPanelDTOMeta `json:"meta"`
}

// LibraryPanelDTOMeta is the meta information for LibraryPanelDTO.
type LibraryPanelDTOMeta struct {
	CanEdit bool `json:"canEdit"`

	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`

	CreatedBy LibraryPanelDTOMetaUser `json:"createdBy"`
	UpdatedBy LibraryPanelDTOMetaUser `json:"updatedBy"`
}

// LibraryPanelDTOMetaUser is the meta information for user that creates/changes the library panel.
type LibraryPanelDTOMetaUser struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	AvatarUrl string `json:"avatarUrl"`
}

// libraryPanelDashboard is the model for library panel connections.
type libraryPanelDashboard struct {
	ID             int64 `xorm:"pk autoincr 'id'"`
	LibraryPanelID int64 `xorm:"librarypanel_id"`
	DashboardID    int64 `xorm:"dashboard_id"`

	Created time.Time

	CreatedBy int64
}

var (
	// errLibraryPanelAlreadyExists is an error for when the user tries to add a library panel that already exists.
	errLibraryPanelAlreadyExists = errors.New("library panel with that name already exists")
	// errLibraryPanelNotFound is an error for when a library panel can't be found.
	errLibraryPanelNotFound = errors.New("library panel could not be found")
	// errLibraryPanelDashboardNotFound is an error for when a library panel connection can't be found.
	errLibraryPanelDashboardNotFound = errors.New("library panel connection could not be found")
	// errLibraryPanelHeaderUIDMissing is an error for when a library panel header is missing the uid property.
	errLibraryPanelHeaderUIDMissing = errors.New("library panel header is missing required property uid")
	// errLibraryPanelHeaderNameMissing is an error for when a library panel header is missing the name property.
	errLibraryPanelHeaderNameMissing = errors.New("library panel header is missing required property name")
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
