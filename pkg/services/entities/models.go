package entities

import (
	"encoding/json"
	"errors"
	"time"
)

type EntityKind int

const (
	Panel EntityKind = iota
	Variable
)

// Entity is the model for entity definitions.
type Entity struct {
	ID          int64  `xorm:"pk autoincr 'id'"`
	OrgID       int64  `xorm:"org_id"`
	FolderID    int64  `xorm:"folder_id"`
	UID         string `xorm:"uid"`
	Name        string
	Kind        EntityKind
	Type        string
	Description string
	Model       json.RawMessage
	Version     int64

	Created time.Time
	Updated time.Time

	CreatedBy int64
	UpdatedBy int64
}

// EntityWithMeta is the model used to retrieve entities with additional meta information.
type EntityWithMeta struct {
	ID          int64  `xorm:"pk autoincr 'id'"`
	OrgID       int64  `xorm:"org_id"`
	FolderID    int64  `xorm:"folder_id"`
	UID         string `xorm:"uid"`
	Name        string
	Kind        EntityKind
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

// EntityDTO is the frontend DTO for entities.
type EntityDTO struct {
	ID          int64           `json:"id"`
	OrgID       int64           `json:"orgId"`
	FolderID    int64           `json:"folderId"`
	UID         string          `json:"uid"`
	Name        string          `json:"name"`
	Kind        EntityKind      `json:"kind"`
	Type        string          `json:"type"`
	Description string          `json:"description"`
	Model       json.RawMessage `json:"model"`
	Version     int64           `json:"version"`
	Meta        EntityDTOMeta   `json:"meta"`
}

// EntitySearchResult is the search result for entities.
type EntitySearchResult struct {
	TotalCount int64       `json:"totalCount"`
	Entities   []EntityDTO `json:"entities"`
	Page       int         `json:"page"`
	PerPage    int         `json:"perPage"`
}

// EntityDTOMeta is the meta information for EntityDTO.
type EntityDTOMeta struct {
	FolderName          string `json:"folderName"`
	FolderUID           string `json:"folderUid"`
	ConnectedDashboards int64  `json:"connectedDashboards"`

	Created time.Time `json:"created"`
	Updated time.Time `json:"updated"`

	CreatedBy EntityDTOMetaUser `json:"createdBy"`
	UpdatedBy EntityDTOMetaUser `json:"updatedBy"`
}

// EntityDTOMetaUser is the meta information for user that creates/changes the entity.
type EntityDTOMetaUser struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	AvatarUrl string `json:"avatarUrl"`
}

var (
	// errEntityAlreadyExists is an error for when the user tries to add a entity that already exists.
	errEntityAlreadyExists = errors.New("entity with that name already exists")
	// errEntityNotFound is an error for when a entity can't be found.
	errEntityNotFound = errors.New("entity could not be found")
	// errEntityDashboardNotFound is an error for when a entity connection can't be found.
	errEntityDashboardNotFound = errors.New("entity connection could not be found")
	// errEntityHeaderUIDMissing is an error for when a entity header is missing the uid property.
	errEntityHeaderUIDMissing = errors.New("entity header is missing required property uid")
	// errEntityHasConnectedDashboards is an error for when an user deletes a entity that is connected to entities.
	errEntityHasConnectedDashboards = errors.New("the entity is linked to dashboards")
)

// Commands

// createEntityCommand is the command for adding a Entity
type createEntityCommand struct {
	FolderID int64           `json:"folderId"`
	Name     string          `json:"name"`
	Model    json.RawMessage `json:"model"`
}
