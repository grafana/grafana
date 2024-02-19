package store

// OrgMigrationState contains information about the state of an org migration.
type OrgMigrationState struct {
	OrgID              int64                       `json:"orgId"`
	MigratedDashboards map[int64]*DashboardUpgrade `json:"migratedDashboards"`
	MigratedChannels   map[int64]*ContactPair      `json:"migratedChannels"`
	CreatedFolders     []string                    `json:"createdFolders"`
}

type DashboardUpgrade struct {
	DashboardID    int64                `json:"dashboardId"`
	AlertFolderUID string               `json:"alertFolderUid"`
	MigratedAlerts map[int64]*AlertPair `json:"migratedAlerts"`
	Warning        string               `json:"warning,omitempty"`
}

type AlertPair struct {
	LegacyID   int64   `json:"legacyId"`
	PanelID    int64   `json:"panelId"`
	NewRuleUID string  `json:"newRuleUid"`
	ChannelIDs []int64 `json:"channelIds"`
	Error      string  `json:"error,omitempty"`
}

type ContactPair struct {
	LegacyID       int64  `json:"legacyId"`
	NewReceiverUID string `json:"newReceiverUid"`
	Error          string `json:"error,omitempty"`
}
