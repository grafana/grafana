package store

type EntityType string

const (
	EntityTypeDashboard EntityType = "dashboard"
	EntityTypeFolder    EntityType = "folder"
	EntityTypeImage     EntityType = "image"
	EntityTypeJSON      EntityType = "json"
)
