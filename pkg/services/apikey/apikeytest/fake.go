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

func (s *Service) GetAllAPIKeys(ctx context.Context, orgID int64) ([]*apikey.APIKey, error) {
	return s.ExpectedAPIKeys, s.ExpectedError
}
func (s *Service) GetApiKeyByName(ctx context.Context, query *apikey.GetByNameQuery) (*apikey.APIKey, error) {
	return s.ExpectedAPIKey, s.ExpectedError
}
func (s *Service) GetAPIKeyByHash(ctx context.Context, hash string) (*apikey.APIKey, error) {
	return s.ExpectedAPIKey, s.ExpectedError
}
func (s *Service) AddAPIKey(ctx context.Context, cmd *apikey.AddCommand) (*apikey.APIKey, error) {
	return s.ExpectedAPIKey, s.ExpectedError
}
func (s *Service) UpdateAPIKeyLastUsedDate(ctx context.Context, tokenID int64) error {
	return s.ExpectedError
}
