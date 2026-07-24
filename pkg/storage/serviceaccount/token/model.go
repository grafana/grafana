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

type GetByNameQuery struct {
	Namespace          string
	ServiceAccountName string
	Name               string
}

type ListResult struct {
	Items    []*Token
	Continue int64
}

type Validator interface {
	GetByHash(ctx context.Context, hash string) (*Token, error)
	GetByName(ctx context.Context, query *GetByNameQuery) (*Token, error)
	UpdateLastUsedDate(ctx context.Context, id string) error
}

type Storage interface {
	Validator
	Add(ctx context.Context, cmd *AddTokenCommand) (*Token, error)
	Delete(ctx context.Context, namespace, serviceAccountName, name string) error
	ListByServiceAccount(ctx context.Context, namespace, serviceAccountName string, limit, continueToken int64) (*ListResult, error)
}
