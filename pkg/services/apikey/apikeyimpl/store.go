package apikeyimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/services/apikey"
	"github.com/grafana/grafana/pkg/services/quota"
)

type store interface {
	GetAllAPIKeys(ctx context.Context, orgID int64) ([]*apikey.APIKey, error)
	AddAPIKey(ctx context.Context, cmd *apikey.AddCommand) (res *apikey.APIKey, err error)
	GetApiKeyByName(ctx context.Context, query *apikey.GetByNameQuery) (res *apikey.APIKey, err error)
	GetAPIKeyByHash(ctx context.Context, hash string) (*apikey.APIKey, error)
	UpdateAPIKeyLastUsedDate(ctx context.Context, tokenID int64) error

	Count(context.Context, *quota.ScopeParameters) (*quota.Map, error)
}
