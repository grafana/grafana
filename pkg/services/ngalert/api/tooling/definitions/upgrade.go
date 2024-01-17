package definitions

// swagger:route GET /v1/upgrade/org upgrade RouteGetOrgUpgrade
//
// Get existing alerting upgrade for the current organization.
//
//     Produces:
//     - application/json
//
//     Responses:
//       200: OrgMigrationState

// swagger:route POST /v1/upgrade/org upgrade RoutePostUpgradeOrg
//
// Upgrade all legacy alerts for the current organization.
//
//     Produces:
//     - application/json
//
//     Responses:
//       200: OrgMigrationSummary

// swagger:route DELETE /v1/upgrade/org upgrade RouteDeleteOrgUpgrade
//
// Delete existing alerting upgrade for the current organization.
//
//     Produces:
//     - application/json
//
//     Responses:
//       200: Ack

// swagger:route POST /v1/upgrade/dashboards/{DashboardID}/panels/{PanelID} upgrade RoutePostUpgradeAlert
//
// Upgrade single legacy dashboard alert for the current organization.
//
//     Produces:
//     - application/json
//
//     Responses:
//       200: OrgMigrationSummary

// swagger:route POST /v1/upgrade/dashboards/{DashboardID} upgrade RoutePostUpgradeDashboard
//
// Upgrade all legacy dashboard alerts on a dashboard for the current organization.
//
//     Produces:
//     - application/json
//
//     Responses:
//       200: OrgMigrationSummary

// swagger:route POST /v1/upgrade/dashboards upgrade RoutePostUpgradeAllDashboards
//
// Upgrade all legacy dashboard alerts for the current organization.
//
//     Produces:
//     - application/json
//
//     Responses:
//       200: OrgMigrationSummary

// swagger:route POST /v1/upgrade/channels upgrade RoutePostUpgradeAllChannels
//
// Upgrade all legacy notification channels for the current organization.
//
//     Produces:
//     - application/json
//
//     Responses:
//       200: OrgMigrationSummary

// swagger:route POST /v1/upgrade/channels/{ChannelID} upgrade RoutePostUpgradeChannel
//
// Upgrade a single legacy notification channel for the current organization.
//
//     Produces:
//     - application/json
//
//     Responses:
//       200: OrgMigrationSummary

// swagger:parameters RoutePostUpgradeOrg RoutePostUpgradeDashboard RoutePostUpgradeAllChannels
type SkipExistingQueryParam struct {
	// If true, legacy alert and notification channel upgrades from previous runs will be skipped. Otherwise, they will be replaced.
	// in:query
	// required:false
	// default:false
	SkipExisting bool
}

// swagger:parameters RoutePostUpgradeAlert RoutePostUpgradeDashboard
type DashboardParam struct {
	// Dashboard ID of dashboard alert.
	// in:path
	// required:true
	DashboardID string
}

// swagger:parameters RoutePostUpgradeAlert
type PanelParam struct {
	// Panel ID of dashboard alert.
	// in:path
	// required:true
	PanelID string
}

// swagger:parameters RoutePostUpgradeChannel
type ChannelParam struct {
	// Channel ID of legacy notification channel.
	// in:path
	// required:true
	ChannelID string
}

// swagger:model
type OrgMigrationSummary struct {
	NewDashboards int  `json:"newDashboards"`
	NewAlerts     int  `json:"newAlerts"`
	NewChannels   int  `json:"newChannels"`
	Removed       bool `json:"removed"`
	HasErrors     bool `json:"hasErrors"`
}

func (s *OrgMigrationSummary) Add(other OrgMigrationSummary) {
	s.NewDashboards += other.NewDashboards
	s.NewAlerts += other.NewAlerts
	s.NewChannels += other.NewChannels
	s.Removed = s.Removed || other.Removed
	s.HasErrors = s.HasErrors || other.HasErrors
}

// swagger:model
type OrgMigrationState struct {
	OrgID              int64               `json:"orgId"`
	MigratedDashboards []*DashboardUpgrade `json:"migratedDashboards"`
	MigratedChannels   []*ContactPair      `json:"migratedChannels"`
}

type DashboardUpgrade struct {
	MigratedAlerts []*AlertPair `json:"migratedAlerts"`
	DashboardID    int64        `json:"dashboardId"`
	DashboardUID   string       `json:"dashboardUid"`
	DashboardName  string       `json:"dashboardName"`
	FolderUID      string       `json:"folderUid"`
	FolderName     string       `json:"folderName"`
	NewFolderUID   string       `json:"newFolderUid,omitempty"`
	NewFolderName  string       `json:"newFolderName,omitempty"`
	Provisioned    bool         `json:"provisioned"`
	Warning        string       `json:"warning"`
	Error          string       `json:"error,omitempty"`
}

type AlertPair struct {
	LegacyAlert *LegacyAlert      `json:"legacyAlert"`
	AlertRule   *AlertRuleUpgrade `json:"alertRule"`
	Error       string            `json:"error,omitempty"`
}

type ContactPair struct {
	LegacyChannel       *LegacyChannel       `json:"legacyChannel"`
	ContactPointUpgrade *ContactPointUpgrade `json:"contactPoint"`
	Error               string               `json:"error,omitempty"`
}

type LegacyAlert struct {
	ID          int64  `json:"id"`
	DashboardID int64  `json:"dashboardId"`
	PanelID     int64  `json:"panelId"`
	Name        string `json:"name"`
}

type AlertRuleUpgrade struct {
	UID     string   `json:"uid"`
	Title   string   `json:"title"`
	SendsTo []string `json:"sendsTo"`
}

type LegacyChannel struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
}

type ContactPointUpgrade struct {
	Name          string         `json:"name"`
	Type          string         `json:"type"`
	RouteMatchers ObjectMatchers `json:"routeMatchers"`
}
