package models

// OrgMigrationState contains information about the state of an org migration.
type OrgMigrationState struct {
	OrgID          int64    `json:"orgId"`
	CreatedFolders []string `json:"createdFolders"`
}
