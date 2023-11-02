package models

// OrgMigrationState contains information about the state of an org migration.
type OrgMigrationState struct {
	OrgID          int64    `json:"orgId"`
	CreatedFolders []string `json:"createdFolders"`
}

// DashboardUpgradeInfo contains information about a dashboard that was upgraded.
type DashboardUpgradeInfo struct {
	DashboardUID  string
	DashboardName string
	NewFolderUID  string
	NewFolderName string
}
