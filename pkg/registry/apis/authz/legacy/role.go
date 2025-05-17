package legacy

import (
	"context"
	"fmt"
	"text/template"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type ListRolesQuery struct {
	OrgID int64
	UID   string

	Pagination common.Pagination
}

type ListRolesResult struct {
	Roles    []accesscontrol.Role
	Continue int64
	RV       int64
}

var sqlQueryRolesTemplate = mustTemplate("roles_query.sql")

func newListRoles(sql *legacysql.LegacyDatabaseHelper, q *ListRolesQuery) listRolesQuery {
	return listRolesQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		RoleTable:   sql.Table("role"),
		Query:       q,
	}
}

type listRolesQuery struct {
	sqltemplate.SQLTemplate
	Query     *ListRolesQuery
	RoleTable string
}

func (r listRolesQuery) Validate() error {
	return nil // TODO
}

// ListRoles implements LegacyAccessStore.
func (s *legacySQLStore) ListRoles(ctx context.Context, ns claims.NamespaceInfo, query ListRolesQuery) (*ListRolesResult, error) {
	// for continue
	limit := int(query.Pagination.Limit)
	query.Pagination.Limit += 1

	query.OrgID = ns.OrgID
	if ns.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero orgID")
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	res, err := s.queryRoles(ctx, sql, sqlQueryRolesTemplate, newListRoles(sql, &query), limit)
	if err == nil && query.UID != "" {
		res.RV, err = sql.GetResourceVersion(ctx, "role", "updated")
	}

	return res, err
}

func (s *legacySQLStore) queryRoles(ctx context.Context, sql *legacysql.LegacyDatabaseHelper, t *template.Template, req sqltemplate.Args, limit int) (*ListRolesResult, error) {
	q, err := sqltemplate.Execute(t, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", t.Name(), err)
	}

	res := &ListRolesResult{}
	rows, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()

	if err == nil {
		var lastID int64
		for rows.Next() {
			r := accesscontrol.Role{}
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
		}
	}

	return res, err
}
