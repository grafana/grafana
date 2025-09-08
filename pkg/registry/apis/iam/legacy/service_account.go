package legacy

import (
	"context"
	"errors"
	"fmt"
	"time"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
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
	Role     string
	Created  time.Time
	Updated  time.Time
}

type CreateServiceAccountCommand struct {
	UID        string
	Name       string
	Email      string
	Login      string
	Role       string
	IsDisabled bool
	OrgID      int64
	Created    DBTime
	Updated    DBTime
	LastSeenAt time.Time
}

type CreateServiceAccountResult struct {
	ServiceAccount ServiceAccount
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
		err := rows.Scan(&s.ID, &s.UID, &s.Name, &s.Disabled, &s.Role, &s.Created, &s.Updated)
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

func (listServiceAccountTokensQuery) Validate() error {
	return nil // TODO
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

var sqlCreateServiceAccountTemplate = mustTemplate("create_service_account.sql")

func newCreateServiceAccount(sql *legacysql.LegacyDatabaseHelper, cmd *CreateServiceAccountCommand) createServiceAccountQuery {
	return createServiceAccountQuery{
		SQLTemplate:  sqltemplate.New(sql.DialectForDriver()),
		UserTable:    sql.Table("user"),
		OrgUserTable: sql.Table("org_user"),
		Command:      cmd,
	}
}

type createServiceAccountQuery struct {
	sqltemplate.SQLTemplate
	UserTable    string
	OrgUserTable string
	Command      *CreateServiceAccountCommand
}

func (r createServiceAccountQuery) Validate() error {
	return nil
}

func (s *legacySQLStore) CreateServiceAccount(ctx context.Context, ns claims.NamespaceInfo, cmd CreateServiceAccountCommand) (*CreateServiceAccountResult, error) {
	cmd.OrgID = ns.OrgID
	cmd.Email = cmd.Login

	now := time.Now().UTC().Truncate(time.Second)
	lastSeenAt := now.AddDate(-10, 0, 0) // Set last seen 10 years ago like in user service

	cmd.Created = NewDBTime(now)
	cmd.Updated = NewDBTime(now)
	cmd.LastSeenAt = lastSeenAt

	if ns.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero org id")
	}

	sql, err := s.sql(ctx)
	if err != nil {
		return nil, err
	}

	req := newCreateServiceAccount(sql, &cmd)

	var createdSA ServiceAccount
	err = sql.DB.GetSqlxSession().WithTransaction(ctx, func(st *session.SessionTx) error {
		userQuery, err := sqltemplate.Execute(sqlCreateServiceAccountTemplate, req)
		if err != nil {
			return fmt.Errorf("execute service account template %q: %w", sqlCreateServiceAccountTemplate.Name(), err)
		}

		serviceAccountID, err := st.ExecWithReturningId(ctx, userQuery, req.GetArgs()...)
		if err != nil {
			return fmt.Errorf("failed to create service account: %w", err)
		}

		orgUserCmd := &CreateOrgUserCommand{
			OrgID:   ns.OrgID,
			UserID:  serviceAccountID,
			Role:    cmd.Role,
			Created: cmd.Created,
			Updated: cmd.Updated,
		}
		orgUserReq := newCreateOrgUser(sql, orgUserCmd)

		orgUserQuery, err := sqltemplate.Execute(sqlCreateOrgUserTemplate, orgUserReq)
		if err != nil {
			return fmt.Errorf("execute org_user template %q: %w", sqlCreateOrgUserTemplate.Name(), err)
		}

		_, err = st.Exec(ctx, orgUserQuery, orgUserReq.GetArgs()...)
		if err != nil {
			return fmt.Errorf("failed to create org_user relationship: %w", err)
		}

		createdSA = ServiceAccount{
			ID:       serviceAccountID,
			UID:      cmd.UID,
			Name:     cmd.Name,
			Role:     cmd.Role,
			Disabled: cmd.IsDisabled,
			Created:  cmd.Created.Time,
			Updated:  cmd.Updated.Time,
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &CreateServiceAccountResult{ServiceAccount: createdSA}, nil
}

func (s *legacySQLStore) DeleteServiceAccount(ctx context.Context, ns claims.NamespaceInfo, cmd DeleteUserCommand) error {
	sql, err := s.sql(ctx)
	if err != nil {
		return err
	}

	cmd.OrgID = ns.OrgID
	req := newDeleteUser(sql, &cmd)
	if err := req.Validate(); err != nil {
		return err
	}

	err = sql.DB.GetSqlxSession().WithTransaction(ctx, func(st *session.SessionTx) error {
		userLookupReq := newGetServiceAccountInternalID(sql, &GetServiceAccountInternalIDQuery{
			OrgID: ns.OrgID,
			UID:   cmd.UID,
		})

		userQuery, err := sqltemplate.Execute(sqlQueryServiceAccountInternalIDTemplate, userLookupReq)
		if err != nil {
			return fmt.Errorf("execute user lookup template: %w", err)
		}

		rows, err := st.Query(ctx, userQuery, userLookupReq.GetArgs()...)
		if err != nil {
			return fmt.Errorf("failed to check if user exists: %w", err)
		}
		defer func() {
			if rows != nil {
				_ = rows.Close()
			}
		}()

		var userID int64
		if !rows.Next() {
			if err := rows.Err(); err != nil {
				return fmt.Errorf("failed to read user lookup rows: %w", err)
			}
			return fmt.Errorf("user not found")
		}

		if err := rows.Scan(&userID); err != nil {
			return fmt.Errorf("failed to scan user ID: %w", err)
		}

		// Close rows to avoid the bad connection error
		if rows != nil {
			_ = rows.Close()
		}

		orgUserReq := newDeleteOrgUser(sql, userID)
		if err := orgUserReq.Validate(); err != nil {
			return err
		}

		orgUserDeleteQuery, err := sqltemplate.Execute(sqlDeleteOrgUserTemplate, orgUserReq)
		if err != nil {
			return fmt.Errorf("execute org_user delete template: %w", err)
		}

		if _, err := st.Exec(ctx, orgUserDeleteQuery, orgUserReq.GetArgs()...); err != nil {
			return fmt.Errorf("failed to delete org_user relationship: %w", err)
		}

		deleteQuery, err := sqltemplate.Execute(sqlDeleteUserTemplate, req)
		if err != nil {
			return fmt.Errorf("execute service account template %q: %w", sqlDeleteUserTemplate.Name(), err)
		}

		if _, err := st.Exec(ctx, deleteQuery, req.GetArgs()...); err != nil {
			return fmt.Errorf("failed to delete service account: %w", err)
		}

		return nil
	})

	if err != nil {
		return err
	}

	return nil
}
