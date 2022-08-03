package apikey

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type Service interface {
	GetAPIKeys(ctx context.Context, query *models.GetApiKeysQuery) error
	GetAllAPIKeys(ctx context.Context, orgID int64) []*models.ApiKey
	DeleteApiKey(ctx context.Context, cmd *models.DeleteApiKeyCommand) error
	AddAPIKey(ctx context.Context, cmd *models.AddApiKeyCommand) error
	GetApiKeyById(ctx context.Context, query *models.GetApiKeyByIdQuery) error
	GetApiKeyByName(ctx context.Context, query *models.GetApiKeyByNameQuery) error
	GetAPIKeyByHash(ctx context.Context, hash string) (*models.ApiKey, error)
	UpdateAPIKeyLastUsedDate(ctx context.Context, tokenID int64) error
}
