package extsvcaccounts

import (
	"github.com/grafana/grafana/pkg/models/roletype"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

type ManageExtSvcAccountCmd struct {
	ExtSvcSlug  string
	Enabled     bool
	OrgID       int64
	Permissions []ac.Permission
}

type saveExtSvcAccountCmd struct {
	ExtSvcSlug  string
	OrgID       int64
	Permissions []ac.Permission
	SaID        int64
}

func newRole(r roletype.RoleType) *roletype.RoleType {
	return &r
}

func newBool(b bool) *bool {
	return &b
}
