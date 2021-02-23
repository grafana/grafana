package docstore

import "time"

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

type EntityStore interface {
	GetById(id string) Entity
	CreateEntity(entity Entity)
}
