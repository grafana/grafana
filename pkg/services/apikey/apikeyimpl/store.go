package apikeyimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/quota"
)

type store interface {
	GetAPIKeys(ctx context.Context, query *apikey.GetApiKeysQuery) (res []*apikey.APIKey, err error)
	GetAllAPIKeys(ctx context.Context, orgID int64) ([]*apikey.APIKey, error)
	CountAPIKeys(ctx context.Context, orgID int64) (int64, error)
	DeleteApiKey(ctx context.Context, cmd *apikey.DeleteCommand) error
	AddAPIKey(ctx context.Context, cmd *apikey.AddCommand) (res *apikey.APIKey, err error)
	GetApiKeyById(ctx context.Context, query *apikey.GetByIDQuery) (res *apikey.APIKey, err error)
	GetApiKeyByName(ctx context.Context, query *apikey.GetByNameQuery) (res *apikey.APIKey, err error)
	GetAPIKeyByHash(ctx context.Context, hash string) (*apikey.APIKey, error)
	UpdateAPIKeyLastUsedDate(ctx context.Context, tokenID int64) error

	Count(context.Context, *quota.ScopeParameters) (*quota.Map, error)
}
