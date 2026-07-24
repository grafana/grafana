package apikey

import (
	"context"
)

type Service interface {
	GetAllAPIKeys(ctx context.Context, orgID int64) ([]*APIKey, error)
	AddAPIKey(ctx context.Context, cmd *AddCommand) (res *APIKey, err error)
	GetApiKeyByName(ctx context.Context, query *GetByNameQuery) (res *APIKey, err error)
	GetAPIKeyByHash(ctx context.Context, hash string) (*APIKey, error)
	UpdateAPIKeyLastUsedDate(ctx context.Context, tokenID int64) error
}
