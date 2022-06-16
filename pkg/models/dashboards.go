package models

// Dashboard is an interface implemented by dashboards.Dashboard. This can be
// removed if and when the DashboardActivityChannel is moved into its own
// service and can import the dashboards.Dashboard. Doing so in this pacakge
// causes import cycles.
type Dashboard interface {
	SetId(int64)
	SetUid(string)
	GetDashboardIdForSavePermissionCheck() int64
	GetUid() string
}
