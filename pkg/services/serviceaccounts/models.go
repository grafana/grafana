package serviceaccounts

import "github.com/grafana/grafana/pkg/services/accesscontrol"

var (
	ScopeAll = "serviceaccounts:*"
	ScopeID  = accesscontrol.Scope("serviceaccounts", "id", accesscontrol.Parameter(":serviceAccountId"))
)

const (
	ActionRead   = "serviceaccounts:read"
	ActionWrite  = "serviceaccounts:write"
	ActionCreate = "serviceaccounts:create"
	ActionDelete = "serviceaccounts:delete"
)

type ServiceAccount struct {
	Id int64
}

type CreateServiceaccountForm struct {
	OrgID int64  `json:"-"`
	Name  string `json:"name" binding:"Required"`
}
