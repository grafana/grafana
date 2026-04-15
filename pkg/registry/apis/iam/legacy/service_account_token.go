package legacy

import (
	"context"
	"errors"
	"fmt"
	"time"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// ErrTokenAlreadyExists is returned when attempting to create a token with a name that already exists.
var ErrTokenAlreadyExists = errors.New("a token with this name already exists for the service account")

// GetServiceAccountTokenQuery retrieves a single token by name within an org.
type GetServiceAccountTokenQuery struct {
	Name              string
	ServiceAccountUID string
	OrgID             int64
}

// CreateServiceAccountTokenCommand creates a new token row in the api_key table.
type CreateServiceAccountTokenCommand struct {
	Name             string
	HashedKey        string
	Role             string
	OrgID            int64
	ServiceAccountID int64
	Expires          *int64
	IsRevoked        bool
	Created          legacysql.DBTime
	Updated          legacysql.DBTime
}

// DeleteServiceAccountTokenCommand deletes a token row from the api_key table.
type DeleteServiceAccountTokenCommand struct {
	Name             string
	OrgID            int64
	ServiceAccountID int64
}

// CreateServiceAccountTokenWithHashCommand stores a pre-generated hashed token in the legacy api_key table.
type CreateServiceAccountTokenWithHashCommand struct {
	TokenName         string // token name used as api_key.name
	HashedKey         string // PBKDF2-SHA256 hash from satokengen
	ServiceAccountUID string // UID of the owning service account
	OrgID             int64  // set automatically from namespace
	Expires           *int64 // unix seconds, nil = never
}

// --- SQL template bindings ---

var sqlQueryServiceAccountTokenGetTemplate = mustTemplate("service_account_token_get_query.sql")

type getServiceAccountTokenQuery struct {
	sqltemplate.SQLTemplate
	Query      *GetServiceAccountTokenQuery
	UserTable  string
	TokenTable string
}

func (q getServiceAccountTokenQuery) Validate() error {
	if q.Query.ServiceAccountUID == "" {
		return fmt.Errorf("expected non empty service account uid")
	}
	return nil
}

func newGetServiceAccountToken(sql *legacysql.LegacyDatabaseHelper, q *GetServiceAccountTokenQuery) getServiceAccountTokenQuery {
	return getServiceAccountTokenQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		UserTable:   sql.Table("user"),
		TokenTable:  sql.Table("api_key"),
		Query:       q,
	}
}

var sqlCreateServiceAccountTokenTemplate = mustTemplate("create_service_account_token.sql")

type createServiceAccountTokenQuery struct {
	sqltemplate.SQLTemplate
	TokenTable string
	Command    *CreateServiceAccountTokenCommand
}

func (createServiceAccountTokenQuery) Validate() error { return nil }

// ExpiresVal dereferences the Expires pointer for use in SQL templates.
// Only call inside a {{ if .Command.Expires }} guard.
func (q createServiceAccountTokenQuery) ExpiresVal() int64 {
	if q.Command.Expires != nil {
		return *q.Command.Expires
	}
	return 0
}

func newCreateServiceAccountToken(sql *legacysql.LegacyDatabaseHelper, cmd *CreateServiceAccountTokenCommand) createServiceAccountTokenQuery {
	return createServiceAccountTokenQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		TokenTable:  sql.Table("api_key"),
		Command:     cmd,
	}
}

var sqlDeleteServiceAccountTokenTemplate = mustTemplate("delete_service_account_token.sql")

type deleteServiceAccountTokenQuery struct {
	sqltemplate.SQLTemplate
	TokenTable string
	Command    *DeleteServiceAccountTokenCommand
}

func (deleteServiceAccountTokenQuery) Validate() error { return nil }

func newDeleteServiceAccountToken(sql *legacysql.LegacyDatabaseHelper, cmd *DeleteServiceAccountTokenCommand) deleteServiceAccountTokenQuery {
	return deleteServiceAccountTokenQuery{
		SQLTemplate: sqltemplate.New(sql.DialectForDriver()),
		TokenTable:  sql.Table("api_key"),
		Command:     cmd,
	}
}

// --- Store implementations ---

func (s *legacySQLStore) GetServiceAccountToken(ctx context.Context, ns claims.NamespaceInfo, query GetServiceAccountTokenQuery) (*ServiceAccountToken, error) {
	query.OrgID = ns.OrgID
	if query.OrgID == 0 {
		return nil, fmt.Errorf("expected non zero org id")
	}

	sql, err := s.getDB(ctx)
	if err != nil {
		return nil, err
	}

	req := newGetServiceAccountToken(sql, &query)
	q, err := sqltemplate.Execute(sqlQueryServiceAccountTokenGetTemplate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlQueryServiceAccountTokenGetTemplate.Name(), err)
	}

	rows, err := sql.DB.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = rows.Close()
	}()

	if !rows.Next() {
		return nil, nil
	}

	var t ServiceAccountToken
	if err := rows.Scan(&t.ID, &t.Name, &t.Revoked, &t.LastUsed, &t.Expires, &t.Created, &t.Updated, &t.ServiceAccountUID, &t.ServiceAccountID); err != nil {
		return nil, err
	}

	return &t, nil
}

func (s *legacySQLStore) DeleteServiceAccountToken(ctx context.Context, ns claims.NamespaceInfo, cmd DeleteServiceAccountTokenCommand) (int64, error) {
	cmd.OrgID = ns.OrgID
	if cmd.OrgID == 0 {
		return 0, fmt.Errorf("expected non zero org id")
	}

	sql, err := s.getDB(ctx)
	if err != nil {
		return 0, err
	}

	req := newDeleteServiceAccountToken(sql, &cmd)
	q, err := sqltemplate.Execute(sqlDeleteServiceAccountTokenTemplate, req)
	if err != nil {
		return 0, fmt.Errorf("execute template %q: %w", sqlDeleteServiceAccountTokenTemplate.Name(), err)
	}

	result, err := sql.DB.GetSqlxSession().Exec(ctx, q, req.GetArgs()...)
	if err != nil {
		return 0, fmt.Errorf("failed to delete service account token: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get rows affected: %w", err)
	}

	return rowsAffected, nil
}

// CreateServiceAccountTokenWithHash stores a pre-generated hashed token in the legacy api_key table.
// Returns ErrTokenAlreadyExists if the DB unique constraint is violated (duplicate name).
// The caller generates the token via satokengen and passes the hash here.
func (s *legacySQLStore) CreateServiceAccountTokenWithHash(
	ctx context.Context,
	ns claims.NamespaceInfo,
	cmd CreateServiceAccountTokenWithHashCommand,
) error {
	cmd.OrgID = ns.OrgID
	if cmd.OrgID == 0 {
		return fmt.Errorf("expected non zero org id")
	}

	sql, err := s.getDB(ctx)
	if err != nil {
		return err
	}

	// Resolve service account internal ID from UID.
	saIDResult, err := s.GetServiceAccountInternalID(ctx, ns, GetServiceAccountInternalIDQuery{
		OrgID: ns.OrgID,
		UID:   cmd.ServiceAccountUID,
	})
	if err != nil {
		return fmt.Errorf("service account not found: %w", err)
	}

	now := time.Now().UTC()

	createCmd := CreateServiceAccountTokenCommand{
		Name:      cmd.TokenName,
		HashedKey: cmd.HashedKey,
		// Not used, set to Viewer by default (https://github.com/grafana/grafana/blob/6e4128bcc235baf2a1ca2f85f4139b33f706fa07/pkg/services/serviceaccounts/database/token_store.go#L54)
		Role:             "Viewer",
		OrgID:            ns.OrgID,
		ServiceAccountID: saIDResult.ID,
		Expires:          cmd.Expires,
		IsRevoked:        false,
		Created:          legacysql.NewDBTime(now),
		Updated:          legacysql.NewDBTime(now),
	}

	createReq := newCreateServiceAccountToken(sql, &createCmd)
	createQuery, err := sqltemplate.Execute(sqlCreateServiceAccountTokenTemplate, createReq)
	if err != nil {
		return fmt.Errorf("execute create template: %w", err)
	}

	return sql.DB.GetSqlxSession().WithTransaction(ctx, func(st *session.SessionTx) error {
		if _, txErr := st.ExecWithReturningId(ctx, createQuery, createReq.GetArgs()...); txErr != nil {
			if dialect := sql.DB.GetDialect(); dialect != nil && dialect.IsUniqueConstraintViolation(txErr) {
				return ErrTokenAlreadyExists
			}
			return fmt.Errorf("failed to create token: %w", txErr)
		}

		return nil
	})
}
