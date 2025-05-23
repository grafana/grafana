package legacy

import (
	"context"
	"errors"
	"fmt"
	"text/template"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type GetRoleInternalIDQuery struct {
	// TODO: consolidate for both core and custom roles
	// OrgID int64
	UID string
}

type GetRoleInternalIDResult struct {
	ID int64
}

var sqlQueryRoleInternalIDTemplate = mustTemplate("role_internal_id.sql")

func newGetRoleInternalID(sql *legacysql.LegacyDatabaseHelper, q *GetRoleInternalIDQuery) getRoleInternalIDQuery {
	return getRoleInternalIDQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		RoleTable:   sql.Table("user"),
		Query:       q,
	}
}

type getRoleInternalIDQuery struct {
	sqltemplate.SQLTemplate
	RoleTable string
	Query     *GetRoleInternalIDQuery
}

func (r getRoleInternalIDQuery) Validate() error {
	return nil // TODO
}

func (s *legacySQLStore) GetRoleInternalID(ctx context.Context, ns claims.NamespaceInfo, query GetRoleInternalIDQuery) (*GetRoleInternalIDResult, error) {
	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newGetRoleInternalID(sql, &query)
	q, err := sqltemplate.Execute(sqlQueryRoleInternalIDTemplate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryRoleInternalIDTemplate.Name(), err)
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
		return nil, errors.New("role not found")
	}

	var id int64
	if err := rows.Scan(&id); err != nil {
		return nil, err
	}

	return &GetRoleInternalIDResult{
		id,
	}, nil
}

type ListCoreRolesQuery struct {
	UID string

	Pagination common.Pagination
}

type ListCoreRolesResult struct {
	Roles    []accesscontrol.RoleDTO
	Continue int64
	RV       int64
}

var sqlQueryCoreRolesTemplate = mustTemplate("core_role_query.sql")

func newListCoreRoles(sql *legacysql.LegacyDatabaseHelper, q *ListCoreRolesQuery) listCoreRolesQuery {
	return listCoreRolesQuery{
		SQLTemplate:      sqltemplate.New(sql.DialectForDriver()),
		RoleTable:        sql.Table("role"),
		FixedRolePattern: sql.Table("fixed:%"),
		Query:            q,
	}
}

type listCoreRolesQuery struct {
	sqltemplate.SQLTemplate
	Query            *ListCoreRolesQuery
	RoleTable        string
	FixedRolePattern string
}

func (r listCoreRolesQuery) Validate() error {
	return nil // TODO
}

// ListRoles implements LegacyAccessStore.
func (s *legacySQLStore) ListCoreRoles(ctx context.Context, ns claims.NamespaceInfo, query ListCoreRolesQuery) (*ListCoreRolesResult, error) {
	// for continue
	limit := int(query.Pagination.Limit)
	query.Pagination.Limit += 1

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	res, err := s.queryRoles(ctx, sql, sqlQueryCoreRolesTemplate, newListCoreRoles(sql, &query), limit)
	if err == nil && query.UID != "" {
		res.RV, err = sql.GetResourceVersion(ctx, "core role", "updated")
	}

	return res, err
}

func (s *legacySQLStore) queryRoles(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, t *template.Template, req sqltemplate.Args, limit int) (*ListCoreRolesResult, error) {
	q, err := sqltemplate.Execute(t, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", t.Name(), err)
	}

	res := &ListCoreRolesResult{}
	rows, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()

	if err == nil {
		var lastID int64
		for rows.Next() {
			r := accesscontrol.RoleDTO{}
			err = rows.Scan(&r.Version, &r.OrgID, &r.ID, &r.UID, &r.Name, &r.DisplayName,
				&r.Description, &r.Group, &r.Hidden, &r.Created, &r.Updated,
			)
			if err != nil {
				return res, err
			}

			lastID = r.ID
			res.Roles = append(res.Roles, r)
			if len(res.Roles) > limit {
				res.Roles = res.Roles[0 : len(res.Roles)-1]
				res.Continue = lastID
				break
			}

			// TODO: Change query to also get permissions?
		}
	}

	return res, err
}
