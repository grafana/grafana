package apikeytest

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type Service struct {
	ExpectedError   error
	ExpectedAPIKeys []*models.ApiKey
	ExpectedAPIKey  *models.ApiKey
}

func (s *Service) GetAPIKeys(ctx context.Context, query *models.GetApiKeysQuery) error {
	query.Result = s.ExpectedAPIKeys
	return s.ExpectedError
}
func (s *Service) GetAllAPIKeys(ctx context.Context, orgID int64) []*models.ApiKey {
	return s.ExpectedAPIKeys
}
func (s *Service) GetApiKeyById(ctx context.Context, query *models.GetApiKeyByIdQuery) error {
	query.Result = s.ExpectedAPIKey
	return s.ExpectedError
}
func (s *Service) GetApiKeyByName(ctx context.Context, query *models.GetApiKeyByNameQuery) error {
	query.Result = s.ExpectedAPIKey
	return s.ExpectedError
}
func (s *Service) GetAPIKeyByHash(ctx context.Context, hash string) (*models.ApiKey, error) {
	return s.ExpectedAPIKey, s.ExpectedError
}
func (s *Service) DeleteApiKey(ctx context.Context, cmd *models.DeleteApiKeyCommand) error {
	return s.ExpectedError
}
func (s *Service) AddAPIKey(ctx context.Context, cmd *models.AddApiKeyCommand) error {
	cmd.Result = s.ExpectedAPIKey
	return s.ExpectedError
}
func (s *Service) UpdateAPIKeyLastUsedDate(ctx context.Context, tokenID int64) error {
	return s.ExpectedError
}
