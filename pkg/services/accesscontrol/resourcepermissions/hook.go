package resourcepermissions

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type ResourceHooks struct {
	User        UserResourceHookFunc
	Team        TeamResourceHookFunc
	BuiltInRole BuiltinResourceHookFunc
}

// The hooks run inside the transaction the store opened on the database its provider resolved for
// ctx. They get that ctx so anything they write resolves its tables for the same tenant, and they
// must write through session.
type UserResourceHookFunc func(ctx context.Context, session *db.Session, orgID int64, user accesscontrol.User, resourceID, permission string) error
type TeamResourceHookFunc func(ctx context.Context, session *db.Session, orgID, teamID int64, resourceID, permission string) error
type BuiltinResourceHookFunc func(ctx context.Context, session *db.Session, orgID int64, builtInRole, resourceID, permission string) error

type User struct {
	ID         int64
	IsExternal bool
}
