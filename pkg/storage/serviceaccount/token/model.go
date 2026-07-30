package token

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/storage/serviceaccount/token/migrator"
)

var (
	ErrTokenNotFound  = errors.New("service account token not found")
	ErrTokenDuplicate = errors.New("service account token already exists")
)

type Token struct {
	ID                 string
	Namespace          string
	Name               string
	Key                string
	Created            time.Time
	Updated            time.Time
	LastUsedAt         *time.Time
	ServiceAccountName string
	IsRevoked          *bool
	Expires            *int64
}

func (*Token) TableName() string {
	return migrator.TableNameToken
}

type AddTokenCommand struct {
	Namespace          string
	Name               string
	Key                string
	ServiceAccountName string
	SecondsToLive      int64
}

type ListResult struct {
	Items    []*Token
	Continue int64
}

type TokenFetcher interface {
	GetByHash(ctx context.Context, namespace, hash string) (*Token, error)
	UpdateLastUsedDate(ctx context.Context, namespace, id string) error
}

type Storage interface {
	TokenFetcher
	Add(ctx context.Context, cmd *AddTokenCommand) (*Token, error)
	Delete(ctx context.Context, namespace, serviceAccountName, name string) error
	ListByServiceAccount(ctx context.Context, namespace, serviceAccountName string, limit, continueToken int64) (*ListResult, error)
}

// EmbeddedStorage is the SQL-backed Storage. It is a distinct type so the store
// selector can be injected a specific implementation rather than itself.
type EmbeddedStorage interface {
	Storage
}
