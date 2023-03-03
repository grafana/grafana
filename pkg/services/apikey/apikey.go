package apikey

import (
	"context"
)

type Service interface {
	GetAPIKeys(ctx context.Context, query *GetApiKeysQuery) error
	GetAllAPIKeys(ctx context.Context, orgID int64) ([]*APIKey, error)
	DeleteApiKey(ctx context.Context, cmd *DeleteCommand) error
	AddAPIKey(ctx context.Context, cmd *AddCommand) error
	GetApiKeyById(ctx context.Context, query *GetByIDQuery) error
	GetApiKeyByName(ctx context.Context, query *GetByNameQuery) error
	GetAPIKeyByHash(ctx context.Context, hash string) (*APIKey, error)
	UpdateAPIKeyLastUsedDate(ctx context.Context, tokenID int64) error
	// IsDisabled returns true if the API key is not available for use.
	IsDisabled(ctx context.Context, orgID int64) (bool, error)
}
