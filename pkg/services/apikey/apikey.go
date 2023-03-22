package apikey

import (
	"context"
)

type Service interface {
	GetAPIKeys(ctx context.Context, query *GetApiKeysQuery) (res []*APIKey, err error)
	GetAllAPIKeys(ctx context.Context, orgID int64) ([]*APIKey, error)
	DeleteApiKey(ctx context.Context, cmd *DeleteCommand) error
	AddAPIKey(ctx context.Context, cmd *AddCommand) (res *APIKey, err error)
	GetApiKeyById(ctx context.Context, query *GetByIDQuery) (res *APIKey, err error)
	GetApiKeyByName(ctx context.Context, query *GetByNameQuery) (res *APIKey, err error)
	GetAPIKeyByHash(ctx context.Context, hash string) (*APIKey, error)
	UpdateAPIKeyLastUsedDate(ctx context.Context, tokenID int64) error
	// IsDisabled returns true if the API key is not available for use.
	IsDisabled(ctx context.Context, orgID int64) (bool, error)
}
