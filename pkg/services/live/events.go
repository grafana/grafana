package live

// DashboardActionType represents what action took place
type DashboardActionType string

const (
	DASHBOARD_ACTION_SAVED   DashboardActionType = "saved"
	DASHBOARD_ACTION_EDITING DashboardActionType = "editing"
	DASHBOARD_ACTION_DELETED DashboardActionType = "deleted"
)

// DashboardEvent events related to dashboards
type DashboardEvent struct {
	UID       string              `json:"uid"`
	Action    DashboardActionType `json:"action"` // saved, editing
	UserID    int64               `json:"userId,omitempty"`
	SessionID string              `json:"sessionId,omitempty"`
}
