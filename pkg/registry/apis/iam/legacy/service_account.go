package legacy

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

type GetServiceAccountInternalIDQuery struct {
	OrgID int64
	UID   string
}

type GetServiceAccountInternalIDResult struct {
	ID int64
}

var sqlQueryServiceAccountInternalIDTemplate = mustTemplate("service_account_internal_id.sql")

func newGetServiceAccountInternalID(sql *legacysql.LegacyDatabaseHelper, q *GetServiceAccountInternalIDQuery) getServiceAccountInternalIDQuery {
	return getServiceAccountInternalIDQuery{
		SQLTemplate:  sqltemplate.New(sql.DialectForDriver()),
		UserTable:    sql.Table("user"),
		OrgUserTable: sql.Table("org_user"),
		Query:        q,
	}
}

type getServiceAccountInternalIDQuery struct {
	sqltemplate.SQLTemplate
	UserTable    string
	OrgUserTable string
	Query        *GetServiceAccountInternalIDQuery
}

func (r getServiceAccountInternalIDQuery) Validate() error {
	return nil // TODO
}

func (s *legacySQLStore) GetServiceAccountInternalID(
	ctx context.Context,
	ns claims.NamespaceInfo,
	query GetServiceAccountInternalIDQuery,
) (*GetServiceAccountInternalIDResult, error) {
	query.OrgID = ns.OrgID
	if query.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero org id")
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newGetServiceAccountInternalID(sql, &query)
	q, err := sqltemplate.Execute(sqlQueryServiceAccountInternalIDTemplate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryServiceAccountInternalIDTemplate.Name(), err)
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
		return nil, errors.New("service account not found")
	}

	var id int64
	if err := rows.Scan(&id); err != nil {
		return nil, err
	}

	return &GetServiceAccountInternalIDResult{
		id,
	}, nil
}

type ListServiceAccountsQuery struct {
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

type ListServiceAccountTokenQuery struct {
	// UID is the service account uid.
	UID        string
	OrgID      int64
	Pagination common.Pagination
}

type ListServiceAccountTokenResult struct {
	Items    []ServiceAccountToken
	Continue int64
	RV       int64
}

type ServiceAccountToken struct {
	ID       int64
	Name     string
	Revoked  bool
	Expires  *int64
	LastUsed *time.Time
	Created  time.Time
	Updated  time.Time
}

var sqlQueryServiceAccountTokensTemplate = mustTemplate("service_account_tokens_query.sql")

func newListServiceAccountTokens(sql *legacysql.LegacyDatabaseHelper, q *ListServiceAccountTokenQuery) listServiceAccountTokensQuery {
	return listServiceAccountTokensQuery{
		SQLTemplate:  sqltemplate.New(sql.DialectForDriver()),
		UserTable:    sql.Table("user"),
		OrgUserTable: sql.Table("org_user"),
		TokenTable:   sql.Table("api_key"),
		Query:        q,
	}
}

type listServiceAccountTokensQuery struct {
	sqltemplate.SQLTemplate
	Query        *ListServiceAccountTokenQuery
	UserTable    string
	TokenTable   string
	OrgUserTable string
}

func (s *legacySQLStore) ListServiceAccountTokens(ctx context.Context, ns claims.NamespaceInfo, query ListServiceAccountTokenQuery) (*ListServiceAccountTokenResult, error) {
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

	req := newListServiceAccountTokens(sql, &query)
	q, err := sqltemplate.Execute(sqlQueryServiceAccountTokensTemplate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryServiceAccountTokensTemplate.Name(), err)
	}

	rows, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	defer func() {
		if rows != nil {
			_ = rows.Close()
		}
	}()

	res := &ListServiceAccountTokenResult{}
	if err != nil {
		return nil, err
	}

	var lastID int64
	for rows.Next() {
		var t ServiceAccountToken
		err := rows.Scan(&t.ID, &t.Name, &t.Revoked, &t.LastUsed, &t.Expires, &t.Created, &t.Updated)
		if err != nil {
			return res, err
		}

		lastID = t.ID
		res.Items = append(res.Items, t)
		if len(res.Items) > int(query.Pagination.Limit)-1 {
			res.Items = res.Items[0 : len(res.Items)-1]
			res.Continue = lastID
			break
		}
	}

	return res, err
}
