package types

import "github.com/grafana/grafana/pkg/services/sqlstore"

type UserResourceHookFunc func(session *sqlstore.DBSession, orgID, userID int64, resourceID, permission string) error
type TeamResourceHookFunc func(session *sqlstore.DBSession, orgID, teamID int64, resourceID, permission string) error
type BuiltinResourceHookFunc func(session *sqlstore.DBSession, orgID int64, builtInRole, resourceID, permission string) error
