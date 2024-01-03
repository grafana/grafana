package store

// SlimAlert is a slimmed down version of the legacy alert model.
type SlimAlert struct {
	ID          int64 `xorm:"id"`
	DashboardID int64 `xorm:"dashboard_id"`
	PanelID     int64 `xorm:"panel_id"`
	Name        string
}

// SlimAlertRule is a slimmed down version of the alert rule model.
type SlimAlertRule struct {
	UID          string `xorm:"uid"`
	Title        string
	NamespaceUID string `xorm:"namespace_uid"`
	Labels       map[string]string
}

// SlimDashboard is a slimmed down version of the dashboard model.
type SlimDashboard struct {
	ID          int64  `xorm:"id"`
	FolderID    int64  `xorm:"folder_id"`
	UID         string `xorm:"uid"`
	Title       string
	Provisioned bool
}
