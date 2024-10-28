package common

// Common relation for each resource
const (
	RelationView  string = "view"
	RelationEdit  string = "edit"
	RelationAdmin string = "admin"

	RelationRead             string = "read"
	RelationWrite            string = "write"
	RelationCreate           string = "create"
	RelationDelete           string = "delete"
	RelationPermissionsRead  string = "permissions_read"
	RelationPermissionsWrite string = "permissions_write"
)

var ResourceRelations = [...]string{
	RelationRead,
	RelationWrite,
	RelationCreate,
	RelationDelete,
	RelationPermissionsRead,
	RelationPermissionsWrite,
}
