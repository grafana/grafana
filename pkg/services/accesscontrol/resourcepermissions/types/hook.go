package types

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type UserResourceHookFunc func(session *sqlstore.DBSession, orgID int64, user resourcepermissions.User, resourceID, permission string) error
type TeamResourceHookFunc func(session *sqlstore.DBSession, orgID, teamID int64, resourceID, permission string) error
type BuiltinResourceHookFunc func(session *sqlstore.DBSession, orgID int64, builtInRole, resourceID, permission string) error
