package store

import (
	"fmt"

	"golang.org/x/net/context"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type Store interface {
	GetUserIdentifiers(ctx context.Context, query UserIdentifierQuery) (*UserIdentifiers, error)
	GetBasicRoles(ctx context.Context, ns claims.NamespaceInfo, query BasicRoleQuery) (*BasicRole, error)
}

type StoreImpl struct {
	sql    legacysql.LegacyDatabaseProvider
	tracer tracing.Tracer
}

func NewStore(sql legacysql.LegacyDatabaseProvider, tracer tracing.Tracer) *StoreImpl {
	return &StoreImpl{
		sql:    sql,
		tracer: tracer,
	}
}

func (s *StoreImpl) GetUserIdentifiers(ctx context.Context, query UserIdentifierQuery) (*UserIdentifiers, error) {
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.database.GetUserIdentifiers")
	defer span.End()

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
	ctx, span := s.tracer.Start(ctx, "authz_direct_db.database.GetBasicRoles")
	defer span.End()

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
