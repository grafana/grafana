package apikeytest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/apikey"
)

type Service struct {
	ExpectedError   error
	ExpectedBool    bool
	ExpectedAPIKeys []*apikey.APIKey
	ExpectedAPIKey  *apikey.APIKey
}

func (s *Service) GetAPIKeys(ctx context.Context, query *apikey.GetApiKeysQuery) ([]*apikey.APIKey, error) {
	return s.ExpectedAPIKeys, s.ExpectedError
}
func (s *Service) GetAllAPIKeys(ctx context.Context, orgID int64) ([]*apikey.APIKey, error) {
	return s.ExpectedAPIKeys, s.ExpectedError
}
func (s *Service) GetApiKeyById(ctx context.Context, query *apikey.GetByIDQuery) (*apikey.APIKey, error) {
	return s.ExpectedAPIKey, s.ExpectedError
}
func (s *Service) GetApiKeyByName(ctx context.Context, query *apikey.GetByNameQuery) (*apikey.APIKey, error) {
	return s.ExpectedAPIKey, s.ExpectedError
}
func (s *Service) GetAPIKeyByHash(ctx context.Context, hash string) (*apikey.APIKey, error) {
	return s.ExpectedAPIKey, s.ExpectedError
}
func (s *Service) DeleteApiKey(ctx context.Context, cmd *apikey.DeleteCommand) error {
	return s.ExpectedError
}
func (s *Service) AddAPIKey(ctx context.Context, cmd *apikey.AddCommand) (*apikey.APIKey, error) {
	return s.ExpectedAPIKey, s.ExpectedError
}
func (s *Service) UpdateAPIKeyLastUsedDate(ctx context.Context, tokenID int64) error {
	return s.ExpectedError
}
func (s *Service) IsDisabled(ctx context.Context, orgID int64) (bool, error) {
	return s.ExpectedBool, s.ExpectedError
}
