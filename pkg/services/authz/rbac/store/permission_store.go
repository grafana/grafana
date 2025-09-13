package store

import (
	"context"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type PermissionStore interface {
	GetUserPermissions(ctx context.Context, ns types.NamespaceInfo, query PermissionsQuery) ([]accesscontrol.Permission, error)
}

type PermissionsQuery struct {
	OrgID         int64
	UserID        int64
	Action        string
	ActionSets    []string
	TeamIDs       []int64
	Role          string
	IsServerAdmin bool
}

func NewSQLPermissionStore(sql legacysql.LegacyDatabaseProvider, tracer tracing.Tracer) *SQLPermissionsStore {
	return &SQLPermissionsStore{sql, tracer}
}

var _ PermissionStore = (*SQLPermissionsStore)(nil)

type SQLPermissionsStore struct {
	sql    legacysql.LegacyDatabaseProvider
	tracer tracing.Tracer
}

var sqlUserPerms = mustTemplate("permission_query.sql")

type getPermissionsQuery struct {
	sqltemplate.SQLTemplate
	Query *PermissionsQuery

	PermissionTable  string
	UserRoleTable    string
	TeamRoleTable    string
	BuiltinRoleTable string
}

func (r getPermissionsQuery) Validate() error {
	return nil
}

func newGetPermissions(sql *legacysql.LegacyDatabaseHelper, q *PermissionsQuery) getPermissionsQuery {
	return getPermissionsQuery{
		SQLTemplate:      sqltemplate.New(sql.DialectForDriver()),
		Query:            q,
		PermissionTable:  sql.Table("permission"),
		UserRoleTable:    sql.Table("user_role"),
		TeamRoleTable:    sql.Table("team_role"),
		BuiltinRoleTable: sql.Table("builtin_role"),
	}
}

func (s *SQLPermissionsStore) GetUserPermissions(ctx context.Context, ns types.NamespaceInfo, query PermissionsQuery) ([]accesscontrol.Permission, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.database.GetUserPermissions")
	defer span.End()

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	query.OrgID = ns.OrgID
	req := newGetPermissions(sql, &query)
	q, err := sqltemplate.Execute(sqlUserPerms, req)
	if err != nil {
		return nil, err
	}

	res, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	if err != nil {
		return nil, err
	}
	defer func() {
		if res != nil {
			_ = res.Close()
		}
	}()

	var perms []accesscontrol.Permission
	for res.Next() {
		var perm accesscontrol.Permission
		if err := res.Scan(&perm.Kind, &perm.Attribute, &perm.Identifier, &perm.Scope); err != nil {
			return nil, err
		}
		// TODO: Why is the Scope set to '::' when it should be empty in the DB?
		if perm.Scope == "::" {
			perm.Scope = ""
		}
		perms = append(perms, perm)
	}

	return perms, nil
}

var _ PermissionStore = (*StaticPermissionStore)(nil)

func NewStaticPermissionStore(ac accesscontrol.Service) *StaticPermissionStore {
	return &StaticPermissionStore{ac}
}

type StaticPermissionStore struct {
	ac accesscontrol.Service
}

func (s *StaticPermissionStore) GetUserPermissions(ctx context.Context, ns types.NamespaceInfo, query PermissionsQuery) ([]accesscontrol.Permission, error) {
	roles := []string{query.Role}
	if query.IsServerAdmin {
		roles = append(roles, "Grafana Admin")
	}

	static := s.ac.GetStaticRoles(ctx)

	var permissions []accesscontrol.Permission
	for _, name := range roles {
		r, ok := static[name]
		if !ok {
			continue
		}

		for _, p := range r.Permissions {
			if p.Action == query.Action {
				permissions = append(permissions, p)
			}
		}
	}

	return permissions, nil
}

var _ PermissionStore = (*UnionPermissionStore)(nil)

func NewUnionPermissionStore(stores ...PermissionStore) *UnionPermissionStore {
	return &UnionPermissionStore{stores}
}

type UnionPermissionStore struct {
	stores []PermissionStore
}

func (u *UnionPermissionStore) GetUserPermissions(ctx context.Context, ns types.NamespaceInfo, query PermissionsQuery) ([]accesscontrol.Permission, error) {
	var permissions []accesscontrol.Permission
	for _, s := range u.stores {
		result, err := s.GetUserPermissions(ctx, ns, query)
		if err != nil {
			return nil, err
		}
		permissions = append(permissions, result...)
	}
	return permissions, nil
}
