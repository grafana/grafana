package apikeytest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/apikey"
)

type Service struct {
	ExpectedError   error
	ExpectedAPIKeys []*apikey.APIKey
	ExpectedAPIKey  *apikey.APIKey
}

func (s *Service) GetAPIKeys(ctx context.Context, query *apikey.GetApiKeysQuery) error {
	query.Result = s.ExpectedAPIKeys
	return s.ExpectedError
}
func (s *Service) GetAllAPIKeys(ctx context.Context, orgID int64) ([]*apikey.APIKey, error) {
	return s.ExpectedAPIKeys, s.ExpectedError
}
func (s *Service) GetApiKeyById(ctx context.Context, query *apikey.GetByIDQuery) error {
	query.Result = s.ExpectedAPIKey
	return s.ExpectedError
}
func (s *Service) GetApiKeyByName(ctx context.Context, query *apikey.GetByNameQuery) error {
	query.Result = s.ExpectedAPIKey
	return s.ExpectedError
}
func (s *Service) GetAPIKeyByHash(ctx context.Context, hash string) (*apikey.APIKey, error) {
	return s.ExpectedAPIKey, s.ExpectedError
}
func (s *Service) DeleteApiKey(ctx context.Context, cmd *apikey.DeleteCommand) error {
	return s.ExpectedError
}
func (s *Service) AddAPIKey(ctx context.Context, cmd *apikey.AddCommand) error {
	cmd.Result = s.ExpectedAPIKey
	return s.ExpectedError
}
func (s *Service) UpdateAPIKeyLastUsedDate(ctx context.Context, tokenID int64) error {
	return s.ExpectedError
}
