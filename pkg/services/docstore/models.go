package docstore

import "time"

type EntityStore interface {
	GetEntity(query GetEntityQuery) (GetEntityResponse, error)
	SaveEntity(cmd SaveEntityCommand) (SaveEntityResponse, error)
	ListEntities(cmd ListEntitiesQuery) (ListEntitiesResult, error)
}

type SaveEntityCommand struct {
}

type SaveEntityResponse struct {
}

type GetEntityQuery struct {
	OrgId int64
	Id    string
}

type GetEntityResponse struct {
	Entity Entity
}

// Query to get a list of entities by ids, tags, query or releationships
// So for this you can for example get all dashboards used by a library panel
type ListEntitiesQuery struct {
	OrgId int64
	// To get a specific list of entities by id
	IDs *[]string
	// Filter by tags
	Tags *[]string
	// Filter by entity type
	EntityTypes *[]string
	// Filter by query string (match on title, description etc, container name)
	QueryString *string
	// To query for entities that are related / linked to a specific entity
	Relationship *ListEntitiesRelationshipFilter
	// Minimum permission
	Permission string
	// User used for permission filtering
	User         EntityUserInfo
	Page         int64
	ItemsPerPage int64
}

type ListEntitiesRelationshipFilter struct {
	Id string
}

type ListEntitiesResult struct {
	// Should probably be EntityListItem (some list item projection)
	Items      []Entity
	Page       int64
	PageCount  int64
	TotalCount int64
}

type Entity struct {
	Meta EntityMetaRead
	Doc  interface{}
}

type EntityMetaCommon struct {
	OrgId int64
	// Thinking similar/same as uid
	Id string
	// For syncing with external systems (maybe repo and file path?)
	ExternalId string
	// Entity name
	Name string
	// Entity type
	Type string
	// Entity description
	Description string
	// For filtering & categorization, alternative option is a key/value labelset
	Tags []EntityTag
	// Relationships
	Relationships []EntityRelationship
	// For optimistic concurrency
	Version int64
}

type EntityMetaWrite struct {
	EntityMetaCommon
	// Thinking folder here
	ContainerId string
}

type EntityMetaRead struct {
	EntityMetaCommon
	// Folder info (name title etc)
	Container EntityMetaContainer
	// Permissions for the user who fetched the entity
	Permissions EntityPermissions
	// Dates
	CreatedOn time.Time
	UpdatedOn time.Time
	// Created by user
	CreatedBy EntityUserInfo
	UpdatedBy EntityUserInfo
}

type EntityPermissions struct {
	CanEdit  bool
	CanView  bool
	CanAdmin bool
}

type EntityUserInfo struct {
	Name      string
	Login     string
	Email     string
	AvatarUrl string
}

// Just the meta info for a a container
type EntityMetaContainer struct {
	Name        string
	ContainerId string
	ExternalId  string
}

type EntityRelationship struct {
	Name       string
	Id         string
	OrgId      int64
	EntityType string
	IsChild    bool
}

type EntityTag struct {
	Name  string
	Id    string
	OrgId int64
	Color string
}
