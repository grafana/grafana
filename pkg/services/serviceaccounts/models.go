package serviceaccounts

import "github.com/grafana/grafana/pkg/services/accesscontrol"

var (
	ScopeAll = "serviceaccounts:*"
	ScopeID  = accesscontrol.Scope("serviceaccounts", "id", accesscontrol.Parameter(":serviceaccountId"))
)

const (
	ActionRead   = "serviceaccounts:read"
	ActionWrite  = "serviceaccounts:write"
	ActionCreate = "serviceaccounts:create"
	ActionDelete = "serviceaccounts:delete"
	// possible to query the /status endpoint
	ActionStatusRead = "serviceaccounts.status:read"
)

type Status struct {
	Enabled bool `json:"enabled"`
}
