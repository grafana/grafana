package docstore

import "time"

type EntityStore interface {
	GetEntity(query GetEntityQuery) (GetEntityResponse, error)
	SaveEntity(cmd SaveEntityCommand) (SaveEntityResponse, error)
	ListEntities(cmd ListEntitiesQuery) (ListEntitiesResult, error)
}

type SaveEntityCommand struct{}
type SaveEntityResponse struct{}

type GetEntityQuery struct {
	OrgId int64
	Id    string
}
type GetEntityResponse struct {
	Entity Entity
}

type ListEntitiesQuery struct {
	OrgId       int64
	IDs         []string
	Tags        []string
	QueryString string
	// To filter list by
	User         EntityUserInfo
	Page         int64
	ItemsPerPage int64
}

type ListEntitiesResult struct {
	Items      []Entity
	Page       int64
	PageCount  int64
	TotalCount int64
}

type Entity struct {
	Meta EntityMeta
	Doc  interface{}
}

type EntityMeta struct {
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
	// Thinking folder here
	Container EntityMetaContainer
	// Dates
	CreatedOn time.Time
	UpdatedOn time.Time
	// Created by user
	CreatedBy EntityUserInfo
	UpdatedBy EntityUserInfo
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
