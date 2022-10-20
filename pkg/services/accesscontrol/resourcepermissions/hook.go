package resourcepermissions

import (
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type ResourceHooks struct {
	User        UserResourceHookFunc
	Team        TeamResourceHookFunc
	BuiltInRole BuiltinResourceHookFunc
}

type UserResourceHookFunc func(session *db.Session, orgID int64, user accesscontrol.User, resourceID, permission string) error
type TeamResourceHookFunc func(session *db.Session, orgID, teamID int64, resourceID, permission string) error
type BuiltinResourceHookFunc func(session *db.Session, orgID int64, builtInRole, resourceID, permission string) error

type User struct {
	ID         int64
	IsExternal bool
}
