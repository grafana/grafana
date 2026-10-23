package store

import (
	"context"
	"fmt"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type PermissionStore interface {
	GetUserPermissions(ctx context.Context, ns types.NamespaceInfo, query PermissionsQuery) ([]accesscontrol.Permission, error)
	HasUserPermissions(ctx context.Context, ns types.NamespaceInfo, query PermissionsQuery) (bool, error)
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

func NewSQLPermissionStore(sql legacysql.LegacyDatabaseProvider, tracer tracing.Tracer, forcePermissionRoleActionIndex bool) *SQLPermissionsStore {
	return &SQLPermissionsStore{
		sql:                            sql,
		tracer:                         tracer,
		forcePermissionRoleActionIndex: forcePermissionRoleActionIndex,
	}
}

var _ PermissionStore = (*SQLPermissionsStore)(nil)

type SQLPermissionsStore struct {
	sql                            legacysql.LegacyDatabaseProvider
	tracer                         tracing.Tracer
	forcePermissionRoleActionIndex bool
}

var (
	sqlUserPerms    = mustTemplate("permission_query.sql")
	sqlUserHasPerms = mustTemplate("permission_exists_query.sql")
)

type getPermissionsQuery struct {
	sqltemplate.SQLTemplate
	Query                          *PermissionsQuery
	ForcePermissionRoleActionIndex bool

	PermissionTable  string
	UserRoleTable    string
	TeamRoleTable    string
	BuiltinRoleTable string
}

func (r getPermissionsQuery) Validate() error {
	return nil
}

func newGetPermissions(sql *legacysql.LegacyDatabaseHelper, q *PermissionsQuery, forcePermissionRoleActionIndex bool) getPermissionsQuery {
	return getPermissionsQuery{
		SQLTemplate:                    sqltemplate.New(sql.DialectForDriver()),
		Query:                          q,
		ForcePermissionRoleActionIndex: forcePermissionRoleActionIndex,
		PermissionTable:                sql.Table("permission"),
		UserRoleTable:                  sql.Table("user_role"),
		TeamRoleTable:                  sql.Table("team_role"),
		BuiltinRoleTable:               sql.Table("builtin_role"),
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
	req := newGetPermissions(sql, &query, s.forcePermissionRoleActionIndex)
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
		perm.Action = query.Action
		var err error
		if query.Action == "" {
			err = res.Scan(&perm.Action, &perm.Kind, &perm.Attribute, &perm.Identifier, &perm.Scope)
		} else {
			err = res.Scan(&perm.Kind, &perm.Attribute, &perm.Identifier, &perm.Scope)
		}
		if err != nil {
			return nil, err
		}
		perms = append(perms, perm)
	}

	if err := res.Err(); err != nil {
		return nil, fmt.Errorf("error getting permissions: %w", err)
	}

	return perms, nil
}

func (s *SQLPermissionsStore) HasUserPermissions(
	ctx context.Context,
	ns types.NamespaceInfo,
	query PermissionsQuery,
) (bool, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.database.HasUserPermissions")
	defer span.End()

	sql, err := s.sql(ctx)
	if err != nil {
		return false, fmt.Errorf("error getting SQL database: %w", err)
	}

	query.OrgID = ns.OrgID
	req := newGetPermissions(sql, &query, s.forcePermissionRoleActionIndex)
	q, err := sqltemplate.Execute(sqlUserHasPerms, req)
	if err != nil {
		return false, fmt.Errorf("error executing query: %w", err)
	}

	res, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	if err != nil {
		return false, fmt.Errorf("error checking user permissions: %w", err)
	}
	defer func() { _ = res.Close() }()

	exists := res.Next()
	if err := res.Err(); err != nil {
		return false, fmt.Errorf("error checking user permissions: %w", err)
	}

	return exists, nil
}

var _ PermissionStore = (*StaticPermissionStore)(nil)

func NewStaticPermissionStore(ac accesscontrol.Service) *StaticPermissionStore {
	return &StaticPermissionStore{ac}
}

type StaticPermissionStore struct {
	ac accesscontrol.Service
}

func (s *StaticPermissionStore) GetUserPermissions(ctx context.Context, ns types.NamespaceInfo, query PermissionsQuery) ([]accesscontrol.Permission, error) {
	var permissions []accesscontrol.Permission
	for _, r := range s.getStaticRoles(ctx, query) {
		for _, p := range r.Permissions {
			if query.Action == "" || p.Action == query.Action {
				permissions = append(permissions, p)
			}
		}
	}

	return permissions, nil
}

func (s *StaticPermissionStore) HasUserPermissions(
	ctx context.Context,
	ns types.NamespaceInfo,
	query PermissionsQuery,
) (bool, error) {
	for _, role := range s.getStaticRoles(ctx, query) {
		for _, permission := range role.Permissions {
			if query.Action == "" || permission.Action == query.Action {
				return true, nil
			}
		}
	}
	return false, nil
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

func (u *UnionPermissionStore) HasUserPermissions(
	ctx context.Context,
	ns types.NamespaceInfo,
	query PermissionsQuery,
) (bool, error) {
	for _, s := range u.stores {
		exists, err := s.HasUserPermissions(ctx, ns, query)
		if err != nil {
			return false, err
		}

		if exists {
			return true, nil
		}
	}

	return false, nil
}

func (s *StaticPermissionStore) getStaticRoles(
	ctx context.Context,
	query PermissionsQuery,
) []*accesscontrol.RoleDTO {
	names := []string{query.Role}
	if query.IsServerAdmin {
		names = append(names, "Grafana Admin")
	}

	static := s.ac.GetStaticRoles(ctx)
	var roles []*accesscontrol.RoleDTO
	for _, name := range names {
		if role, ok := static[name]; ok {
			roles = append(roles, role)
		}
	}
	return roles
}
