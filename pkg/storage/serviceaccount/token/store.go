package token

import (
	"context"
	"fmt"
	"text/template"
	"time"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/storage/serviceaccount/token/contracts"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

const defaultListLimit int64 = 500

type store struct {
	db      contracts.Database
	dialect sqltemplate.Dialect
	tracer  trace.Tracer
}

func ProvideStorage(db contracts.Database, tracer trace.Tracer) (Storage, error) {
	return &store{
		db:      db,
		dialect: sqltemplate.DialectForDriver(db.DriverName()),
		tracer:  tracer,
	}, nil
}

func ProvideValidator(storage Storage) Validator {
	return storage
}

func (s *store) Add(ctx context.Context, cmd *AddTokenCommand) (*Token, error) {
	ctx, span := s.tracer.Start(ctx, "ServiceAccountTokenStorage.Add")
	defer span.End()

	now := time.Now().UTC()
	revoked := false
	row := &Token{
		ID:                 uuid.NewString(),
		Namespace:          cmd.Namespace,
		Name:               cmd.Name,
		Key:                cmd.Key,
		Created:            now,
		Updated:            now,
		ServiceAccountName: cmd.ServiceAccountName,
		IsRevoked:          &revoked,
	}
	if cmd.SecondsToLive > 0 {
		expires := now.Unix() + cmd.SecondsToLive
		row.Expires = &expires
	}

	req := createToken{
		SQLTemplate: sqltemplate.New(s.dialect),
		Row:         row,
		IsRevoked:   revoked,
	}
	query, err := sqltemplate.Execute(sqlTokenCreate, req)
	if err != nil {
		return nil, fmt.Errorf("executing template %q: %w", sqlTokenCreate.Name(), err)
	}

	result, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		if sql.IsRowAlreadyExistsError(err) {
			return nil, ErrTokenDuplicate
		}
		return nil, fmt.Errorf("inserting token: %w", err)
	}
	if err := expectOneRow(result.RowsAffected()); err != nil {
		return nil, err
	}

	return row, nil
}

func (s *store) GetByName(ctx context.Context, query *GetByNameQuery) (*Token, error) {
	ctx, span := s.tracer.Start(ctx, "ServiceAccountTokenStorage.GetByName")
	defer span.End()

	req := getTokenByName{
		SQLTemplate: sqltemplate.New(s.dialect),
		Query:       query,
	}
	return s.queryOne(ctx, sqlTokenGetByName, req)
}

func (s *store) GetByHash(ctx context.Context, hash string) (*Token, error) {
	ctx, span := s.tracer.Start(ctx, "ServiceAccountTokenStorage.GetByHash")
	defer span.End()

	req := getTokenByHash{
		SQLTemplate: sqltemplate.New(s.dialect),
		Hash:        hash,
	}
	return s.queryOne(ctx, sqlTokenGetByHash, req)
}

func (s *store) UpdateLastUsedDate(ctx context.Context, id string) error {
	ctx, span := s.tracer.Start(ctx, "ServiceAccountTokenStorage.UpdateLastUsedDate", trace.WithAttributes(attribute.String("token.id", id)))
	defer span.End()

	req := updateTokenLastUsed{
		SQLTemplate: sqltemplate.New(s.dialect),
		ID:          id,
		LastUsedAt:  time.Now().UTC(),
	}
	query, err := sqltemplate.Execute(sqlTokenUpdateLastUsed, req)
	if err != nil {
		return fmt.Errorf("executing template %q: %w", sqlTokenUpdateLastUsed.Name(), err)
	}
	result, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("updating token last-used date: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("getting rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return ErrTokenNotFound
	}
	if rowsAffected != 1 {
		return fmt.Errorf("expected 1 row affected, got %d", rowsAffected)
	}
	return nil
}

func (s *store) Delete(ctx context.Context, namespace, serviceAccountName, name string) error {
	ctx, span := s.tracer.Start(ctx, "ServiceAccountTokenStorage.Delete")
	defer span.End()

	req := deleteToken{
		SQLTemplate:        sqltemplate.New(s.dialect),
		Namespace:          namespace,
		ServiceAccountName: serviceAccountName,
		Name:               name,
	}
	query, err := sqltemplate.Execute(sqlTokenDelete, req)
	if err != nil {
		return fmt.Errorf("executing template %q: %w", sqlTokenDelete.Name(), err)
	}
	result, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("deleting token: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("getting rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return ErrTokenNotFound
	}
	if rowsAffected != 1 {
		return fmt.Errorf("expected 1 row affected, got %d", rowsAffected)
	}
	return nil
}

func (s *store) ListByServiceAccount(ctx context.Context, namespace, serviceAccountName string, limit, continueToken int64) (*ListResult, error) {
	ctx, span := s.tracer.Start(ctx, "ServiceAccountTokenStorage.ListByServiceAccount")
	defer span.End()

	if limit < 1 {
		limit = defaultListLimit
	}
	if continueToken < 0 {
		continueToken = 0
	}

	req := listTokensByServiceAccount{
		SQLTemplate:        sqltemplate.New(s.dialect),
		Namespace:          namespace,
		ServiceAccountName: serviceAccountName,
		Limit:              limit + 1,
		Offset:             continueToken,
	}
	query, err := sqltemplate.Execute(sqlTokenListBySA, req)
	if err != nil {
		return nil, fmt.Errorf("executing template %q: %w", sqlTokenListBySA.Name(), err)
	}
	rows, err := s.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("listing tokens: %w", err)
	}
	defer func() { _ = rows.Close() }()

	result := &ListResult{Items: make([]*Token, 0, limit)}
	for rows.Next() {
		token := &Token{}
		if err := scanToken(rows, token); err != nil {
			return nil, fmt.Errorf("scanning token: %w", err)
		}
		result.Items = append(result.Items, token)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("reading token rows: %w", err)
	}
	if int64(len(result.Items)) > limit {
		result.Items = result.Items[:limit]
		result.Continue = continueToken + limit
	}
	return result, nil
}

type queryRequest interface {
	GetArgs() []any
}

func (s *store) queryOne(ctx context.Context, tmpl *template.Template, req queryRequest) (*Token, error) {
	query, err := sqltemplate.Execute(tmpl, req)
	if err != nil {
		return nil, fmt.Errorf("executing template %q: %w", tmpl.Name(), err)
	}
	rows, err := s.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("getting token: %w", err)
	}
	defer func() { _ = rows.Close() }()

	if !rows.Next() {
		if err := rows.Err(); err != nil {
			return nil, fmt.Errorf("reading token row: %w", err)
		}
		return nil, ErrTokenNotFound
	}
	token := &Token{}
	if err := scanToken(rows, token); err != nil {
		return nil, fmt.Errorf("scanning token: %w", err)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("reading token row: %w", err)
	}
	return token, nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanToken(rows rowScanner, token *Token) error {
	return rows.Scan(
		&token.ID,
		&token.Namespace,
		&token.Name,
		&token.Key,
		&token.Created,
		&token.Updated,
		&token.LastUsedAt,
		&token.ServiceAccountName,
		&token.IsRevoked,
		&token.Expires,
	)
}

func expectOneRow(rowsAffected int64, err error) error {
	if err != nil {
		return fmt.Errorf("getting rows affected: %w", err)
	}
	if rowsAffected != 1 {
		return fmt.Errorf("expected 1 row affected, got %d", rowsAffected)
	}
	return nil
}
