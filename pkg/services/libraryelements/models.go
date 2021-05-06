package libraryelements

import (
	"encoding/json"
	"errors"
	"time"
)

type LibraryElementKind int

const (
	Panel LibraryElementKind = iota + 1
	Variable
)

// LibraryElement is the model for library element definitions.
type LibraryElement struct {
	ID          int64  `xorm:"pk autoincr 'id'"`
	OrgID       int64  `xorm:"org_id"`
	FolderID    int64  `xorm:"folder_id"`
	UID         string `xorm:"uid"`
	Name        string
	Kind        int64
	Type        string
	Description string
	Model       json.RawMessage
	Version     int64

	Created time.Time
	Updated time.Time

	CreatedBy int64
	UpdatedBy int64
}

// LibraryElementWithMeta is the model used to retrieve entities with additional meta information.
type LibraryElementWithMeta struct {
	ID          int64  `xorm:"pk autoincr 'id'"`
	OrgID       int64  `xorm:"org_id"`
	FolderID    int64  `xorm:"folder_id"`
	UID         string `xorm:"uid"`
	Name        string
	Kind        int64
	Type        string
	Description string
	Model       json.RawMessage
	Version     int64

	Created time.Time
	Updated time.Time

	FolderName          string
	FolderUID           string `xorm:"folder_uid"`
	ConnectedDashboards int64
	CreatedBy           int64
	UpdatedBy           int64
	CreatedByName       string
	CreatedByEmail      string
	UpdatedByName       string
	UpdatedByEmail      string
}

// LibraryElementDTO is the frontend DTO for entities.
type LibraryElementDTO struct {
	ID          int64                 `json:"id"`
	OrgID       int64                 `json:"orgId"`
	FolderID    int64                 `json:"folderId"`
	UID         string                `json:"uid"`
	Name        string                `json:"name"`
	Kind        int64                 `json:"kind"`
	Type        string                `json:"type"`
	Description string                `json:"description"`
	Model       json.RawMessage       `json:"model"`
	Version     int64                 `json:"version"`
	Meta        LibraryElementDTOMeta `json:"meta"`
}

// LibraryElementSearchResult is the search result for entities.
type LibraryElementSearchResult struct {
	TotalCount int64               `json:"totalCount"`
	Elements   []LibraryElementDTO `json:"elements"`
	Page       int                 `json:"page"`
	PerPage    int                 `json:"perPage"`
}

// LibraryElementDTOMeta is the meta information for LibraryElementDTO.
type LibraryElementDTOMeta struct {
	FolderName          string `json:"folderName"`
	FolderUID           string `json:"folderUid"`
	ConnectedDashboards int64  `json:"connectedDashboards"`

	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`

	CreatedBy LibraryElementDTOMetaUser `json:"createdBy"`
	UpdatedBy LibraryElementDTOMetaUser `json:"updatedBy"`
}

// LibraryElementDTOMetaUser is the meta information for user that creates/changes the library element.
type LibraryElementDTOMetaUser struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	AvatarUrl string `json:"avatarUrl"`
}

var (
	// errLibraryElementAlreadyExists is an error for when the user tries to add a library element that already exists.
	errLibraryElementAlreadyExists = errors.New("library element with that name already exists")
	// errLibraryElementNotFound is an error for when a library element can't be found.
	errLibraryElementNotFound = errors.New("library element could not be found")
	// errLibraryElementDashboardNotFound is an error for when a library element connection can't be found.
	errLibraryElementDashboardNotFound = errors.New("library element connection could not be found")
	// errLibraryElementHasConnectedDashboards is an error for when an user deletes a library element that is connected to dashboards.
	errLibraryElementHasConnectedDashboards = errors.New("the library element is linked to dashboards")
	// errLibraryElementVersionMismatch is an error for when a library element has been changed by someone else.
	errLibraryElementVersionMismatch = errors.New("the library element has been changed by someone else")
)

// Commands

// createLibraryElementCommand is the command for adding a LibraryElement
type createLibraryElementCommand struct {
	FolderID int64           `json:"folderId"`
	Name     string          `json:"name"`
	Model    json.RawMessage `json:"model"`
	Kind     int64           `json:"kind" binding:"Required;Range(1,2)"`
}

// patchLibraryElementCommand is the command for patching a LibraryElement
type patchLibraryElementCommand struct {
	FolderID int64           `json:"folderId" binding:"Default(-1)"`
	Name     string          `json:"name"`
	Model    json.RawMessage `json:"model"`
	Kind     int64           `json:"kind" binding:"Required;Range(1,2)"`
	Version  int64           `json:"version" binding:"Required"`
}

// searchLibraryElementsQuery is the query used for searching for Elements
type searchLibraryElementsQuery struct {
	perPage       int
	page          int
	searchString  string
	sortDirection string
	kind          int
	typeFilter    string
	excludeUID    string
	folderFilter  string
}
