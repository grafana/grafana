package resourcepermissions

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type ResourceHooks struct {
	User        UserResourceHookFunc
	Team        TeamResourceHookFunc
	BuiltInRole BuiltinResourceHookFunc
}

type UserResourceHookFunc func(session *sqlstore.DBSession, orgID int64, user accesscontrol.User, resourceID, permission string) error
type TeamResourceHookFunc func(session *sqlstore.DBSession, orgID, teamID int64, resourceID, permission string) error
type BuiltinResourceHookFunc func(session *sqlstore.DBSession, orgID int64, builtInRole, resourceID, permission string) error

type User struct {
	ID         int64
	IsExternal bool
}
