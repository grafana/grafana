package docstore

import "time"

type Entity struct {
}

type EntityMeta struct {
	OrgId       int64
	Id          string
	ExternalId  string
	Name        string
	Type        string
	Description string
	Tags        []string
	Version     int64
	CreatedOn   time.Time
	UpdatedOn   time.Time
	CreatedBy   EntityUserInfo
	UpdatedBy   EntityUserInfo
}

type EntityUserInfo struct {
	Name      string
	Login     string
	Email     string
	AvatarUrl string
}

type EntityMetaContainer struct {
	Name        string
	ContainerId string
	ExternalId  string
}
