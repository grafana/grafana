package ossaccesscontrol

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func init() {
	// TODO move to receivers.go when patch is merged
	ReceiversAdminActions = append(ReceiversAdminActions, accesscontrol.ActionAlertingReceiversUpdateProtected)
}
