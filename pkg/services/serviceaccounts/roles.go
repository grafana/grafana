package serviceaccounts

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// API related actions
const (
	ActionDelete = "serviceaccounts:delete"
)

// API related scopes
var (
	ScopeServiceAccountsAll = accesscontrol.Scope("serviceaccounts", "*")
	ScoepServiceAccountID   = accesscontrol.Scope("serviceaccounts", "id", accesscontrol.Parameter(":datasourceId"))
)
