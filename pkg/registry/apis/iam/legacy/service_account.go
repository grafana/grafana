package legacy

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type ListServiceAccountsQuery struct {
	ID         int64
	UID        string
	OrgID      int64
	Pagination common.Pagination
}

type ListServiceAccountResult struct {
	Items    []ServiceAccount
	Continue int64
	RV       int64
}

type ServiceAccount struct {
	ID       int64
	UID      string
	Name     string
	Disabled bool
	Created  time.Time
	Updated  time.Time
}

var sqlQueryServiceAccountsTemplate = mustTemplate("service_accounts_query.sql")

func newListServiceAccounts(sql *legacysql.LegacyDatabaseHelper, q *ListServiceAccountsQuery) listServiceAccountsQuery {
	return listServiceAccountsQuery{
		SQLTemplate:  sqltemplate.New(sql.DialectForDriver()),
		UserTable:    sql.Table("user"),
		OrgUserTable: sql.Table("org_user"),
		Query:        q,
	}
}

type listServiceAccountsQuery struct {
	sqltemplate.SQLTemplate
	Query        *ListServiceAccountsQuery
	UserTable    string
	OrgUserTable string
}

func (r listServiceAccountsQuery) Validate() error {
	return nil // TODO
}

func (s *legacySQLStore) ListServiceAccounts(ctx context.Context, ns claims.NamespaceInfo, query ListServiceAccountsQuery) (*ListServiceAccountResult, error) {
	// for continue
	query.Pagination.Limit += 1
	query.OrgID = ns.OrgID
	if ns.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero orgID")
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newListServiceAccounts(sql, &query)
	q, err := sqltemplate.Execute(sqlQueryServiceAccountsTemplate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryServiceAccountsTemplate.Name(), err)
	}

	rows, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()

	res := &ListServiceAccountResult{}
	if err != nil {
		return nil, err
	}

	var lastID int64
	for rows.Next() {
		var s ServiceAccount
		err := rows.Scan(&s.ID, &s.UID, &s.Name, &s.Disabled, &s.Created, &s.Updated)
		if err != nil {
			return res, err
		}

		lastID = s.ID
		res.Items = append(res.Items, s)
		if len(res.Items) > int(query.Pagination.Limit)-1 {
			res.Items = res.Items[0 : len(res.Items)-1]
			res.Continue = lastID
			break
		}
	}

	if query.UID == "" {
		// FIXME: we need to filer for service accounts here..
		res.RV, err = sql.GetResourceVersion(ctx, "user", "updated")
	}

	return res, err
}
