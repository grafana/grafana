package filters

import (
	"strings"

	"github.com/grafana/grafana/pkg/services/org"
)

type OrgRoleFilter struct {
	roles []string
}

func NewOrgRoleFilter(params []string) org.Filter {
	if len(params) == 0 || (len(params) == 1 && params[0] == "") {
		return nil
	}
	return &OrgRoleFilter{roles: params}
}

func (r *OrgRoleFilter) WhereCondition() *org.WhereCondition {
	if len(r.roles) == 0 {
		return nil
	}

	joinedRoles := strings.Join(r.roles, "','")

	return &org.WhereCondition{
		Condition: "org_user.role IN ('" + joinedRoles + "')",
		Params:    nil,
	}
}

func (r *OrgRoleFilter) JoinCondition() *org.JoinCondition {
	return nil
}

func (r *OrgRoleFilter) InCondition() *org.InCondition {
	return nil
}
