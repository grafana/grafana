package live

// DashboardEventActionSaved action when dashbord is saved
var DashboardEventActionSaved = "saved"

// DashboardEventActionEditing action when dashbord is edited (sent from client)
var DashboardEventActionEditing = "editing"

// DashboardEventActionDeleted action when dashbord is deleted
var DashboardEventActionDeleted = "deleted"

// DashboardEvent events related to dashboards
type DashboardEvent struct {
	UID       string `json:"uid"`
	Action    string `json:"action"` // saved, editing
	UserID    int64  `json:"userId,omitempty"`
	SessionID string `json:"sessionId,omitempty"`
}
