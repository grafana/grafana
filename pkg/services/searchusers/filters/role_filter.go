package filters

import (
	"github.com/grafana/grafana/pkg/services/user"
	"strings"
)

type RoleFilter struct {
	roles []string
}

func NewRoleFilter(params []string) (user.Filter, error) {
	if len(params) == 0 || (len(params) == 1 && params[0] == "") {
		return nil, nil
	}
	return &RoleFilter{roles: params}, nil
}

func (r *RoleFilter) WhereCondition() *user.WhereCondition {
	if len(r.roles) == 0 {
		return nil
	}

	joinedRoles := strings.Join(r.roles, "','")

	return &user.WhereCondition{
		Condition: "org_user.role IN ('" + joinedRoles + "')",
		Params:    nil,
	}
}

func (r *RoleFilter) JoinCondition() *user.JoinCondition {
	return nil
}

func (r *RoleFilter) InCondition() *user.InCondition {
	return nil
}
