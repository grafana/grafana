package store

import (
	"fmt"

	"github.com/grafana/authlib/claims"
	"golang.org/x/net/context"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type Store interface {
	GetUserPermissions(ctx context.Context, ns claims.NamespaceInfo, query PermissionsQuery) ([]accesscontrol.Permission, error)
	GetUserIdentifiers(ctx context.Context, query UserIdentifierQuery) (*UserIdentifiers, error)
	GetBasicRoles(ctx context.Context, ns claims.NamespaceInfo, query BasicRoleQuery) (*BasicRole, error)
}

type StoreImpl struct {
	sql legacysql.LegacyDatabaseProvider
}

func NewStore(sql legacysql.LegacyDatabaseProvider) *StoreImpl {
	return &StoreImpl{
		sql: sql,
	}
}

func (s *StoreImpl) GetUserPermissions(ctx context.Context, ns claims.NamespaceInfo, query PermissionsQuery) ([]accesscontrol.Permission, error) {
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
		if err := res.Scan(&perm.Action, &perm.Kind, &perm.Attribute, &perm.Identifier, &perm.Scope); err != nil {
			return nil, err
		}
		perms = append(perms, perm)
	}

	return perms, nil
}

func (s *StoreImpl) GetUserIdentifiers(ctx context.Context, query UserIdentifierQuery) (*UserIdentifiers, error) {
	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newGetUserIdentifiers(sql, &query)
	q, err := sqltemplate.Execute(sqlUserIdentifiers, req)
	if err != nil {
		return nil, err
	}

	rows, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()
	if err != nil {
		return nil, err
	}

	if !rows.Next() {
		return nil, fmt.Errorf("user could not be found")
	}

	var userIDs UserIdentifiers
	if err := rows.Scan(&userIDs.ID, &userIDs.UID); err != nil {
		return nil, err
	}

	return &userIDs, nil
}

func (s *StoreImpl) GetBasicRoles(ctx context.Context, ns claims.NamespaceInfo, query BasicRoleQuery) (*BasicRole, error) {
	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	query.OrgID = ns.OrgID
	req := newGetBasicRoles(sql, &query)
	q, err := sqltemplate.Execute(sqlQueryBasicRoles, req)
	if err != nil {
		return nil, err
	}

	rows, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()
	if err != nil {
		return nil, err
	}

	if !rows.Next() {
		return nil, fmt.Errorf("no basic roles found for the user")
	}

	var role BasicRole
	if err := rows.Scan(&role.Role, &role.IsAdmin); err != nil {
		return nil, err
	}

	return &role, nil
}
