package libraryelements

import (
	"encoding/json"
	"errors"
	"time"
)

type LibraryConnectionKind int

const (
	Dashboard LibraryConnectionKind = iota + 1
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
	FolderUID   string                `json:"folderUid"`
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
	AvatarURL string `json:"avatarUrl"`
}

// libraryElementConnection is the model for library element connections.
type libraryElementConnection struct {
	ID           int64 `xorm:"pk autoincr 'id'"`
	ElementID    int64 `xorm:"element_id"`
	Kind         int64 `xorm:"kind"`
	ConnectionID int64 `xorm:"connection_id"`
	Created      time.Time
	CreatedBy    int64
}

// libraryElementConnectionWithMeta is the model for library element connections with meta.
type libraryElementConnectionWithMeta struct {
	ID             int64  `xorm:"pk autoincr 'id'"`
	ElementID      int64  `xorm:"element_id"`
	Kind           int64  `xorm:"kind"`
	ConnectionID   int64  `xorm:"connection_id"`
	ConnectionUID  string `xorm:"connection_uid"`
	Created        time.Time
	CreatedBy      int64
	CreatedByName  string
	CreatedByEmail string
}

// LibraryElementConnectionDTO is the frontend DTO for element connections.
type LibraryElementConnectionDTO struct {
	ID            int64                     `json:"id"`
	Kind          int64                     `json:"kind"`
	ElementID     int64                     `json:"elementId"`
	ConnectionID  int64                     `json:"connectionId"`
	ConnectionUID string                    `json:"connectionUid"`
	Created       time.Time                 `json:"created"`
	CreatedBy     LibraryElementDTOMetaUser `json:"createdBy"`
}

var (
	// errLibraryElementAlreadyExists is an error for when the user tries to add a library element that already exists.
	errLibraryElementAlreadyExists = errors.New("library element with that name or UID already exists")
	// ErrLibraryElementNotFound is an error for when a library element can't be found.
	ErrLibraryElementNotFound = errors.New("library element could not be found")
	// errLibraryElementDashboardNotFound is an error for when a library element connection can't be found.
	errLibraryElementDashboardNotFound = errors.New("library element connection could not be found")
	// errLibraryElementHasConnections is an error for when an user deletes a library element that is connected.
	errLibraryElementHasConnections = errors.New("the library element has connections")
	// errLibraryElementVersionMismatch is an error for when a library element has been changed by someone else.
	errLibraryElementVersionMismatch = errors.New("the library element has been changed by someone else")
	// errLibraryElementUnSupportedElementKind is an error for when the kind is unsupported.
	errLibraryElementUnSupportedElementKind = errors.New("the element kind is not supported")
	// ErrFolderHasConnectedLibraryElements is an error for when a user deletes a folder that contains connected library elements.
	ErrFolderHasConnectedLibraryElements = errors.New("folder contains library elements that are linked in use")
	// errLibraryElementInvalidUID is an error for when the uid of a library element is invalid
	errLibraryElementInvalidUID = errors.New("uid contains illegal characters")
	// errLibraryElementUIDTooLong is an error for when the uid of a library element is invalid
	errLibraryElementUIDTooLong = errors.New("uid too long, max 40 characters")
)

// Commands

// CreateLibraryElementCommand is the command for adding a LibraryElement
// swagger:model
type CreateLibraryElementCommand struct {
	// ID of the folder where the library element is stored.
	FolderID int64 `json:"folderId"`
	// UID of the folder where the library element is stored.
	FolderUID *string `json:"folderUid"`
	// Name of the library element.
	Name string `json:"name"`
	// The JSON model for the library element.
	// swagger:type object
	Model json.RawMessage `json:"model"`
	// Kind of element to create, Use 1 for library panels or 2 for c.
	// Description:
	// * 1 - library panels
	// * 2 - library variables
	// Enum: 1,2
	Kind int64 `json:"kind" binding:"Required"`
	// required: false
	UID string `json:"uid"`
}

// PatchLibraryElementCommand is the command for patching a LibraryElement
type PatchLibraryElementCommand struct {
	// ID of the folder where the library element is stored.
	FolderID int64 `json:"folderId" binding:"Default(-1)"`
	// UID of the folder where the library element is stored.
	FolderUID *string `json:"folderUid"`
	// Name of the library element.
	Name string `json:"name"`
	// The JSON model for the library element.
	Model json.RawMessage `json:"model,omitempty"`
	// Kind of element to create, Use 1 for library panels or 2 for c.
	// Description:
	// * 1 - library panels
	// * 2 - library variables
	// Enum: 1,2
	Kind int64 `json:"kind" binding:"Required"`
	// Version of the library element you are updating.
	Version int64 `json:"version" binding:"Required"`
	// required: false
	UID string `json:"uid"`
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

// LibraryElementResponse is a response struct for LibraryElementDTO.
type LibraryElementResponse struct {
	Result LibraryElementDTO `json:"result"`
}

// LibraryElementSearchResponse is a response struct for LibraryElementSearchResult.
type LibraryElementSearchResponse struct {
	Result LibraryElementSearchResult `json:"result"`
}

// LibraryElementArrayResponse is a response struct for an array of LibraryElementDTO.
type LibraryElementArrayResponse struct {
	Result []LibraryElementDTO `json:"result"`
}

// LibraryElementConnectionsResponse is a response struct for an array of LibraryElementConnectionDTO.
type LibraryElementConnectionsResponse struct {
	Result []LibraryElementConnectionDTO `json:"result"`
}

// DeleteLibraryElementResponse is the response struct for deleting a library element.
type DeleteLibraryElementResponse struct {
	ID      int64  `json:"id"`
	Message string `json:"message"`
}
