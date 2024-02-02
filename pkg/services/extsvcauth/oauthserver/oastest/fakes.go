package oastest

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/services/extsvcauth"
	"github.com/grafana/grafana/pkg/services/extsvcauth/oauthserver"
	"gopkg.in/square/go-jose.v2"
)

type FakeService struct {
	ExpectedClient *oauthserver.OAuthExternalService
	ExpectedKey    *jose.JSONWebKey
	ExpectedErr    error
}

var _ oauthserver.OAuth2Server = &FakeService{}

func (s *FakeService) SaveExternalService(ctx context.Context, cmd *extsvcauth.ExternalServiceRegistration) (*extsvcauth.ExternalService, error) {
	return s.ExpectedClient.ToExternalService(nil), s.ExpectedErr
}

func (s *FakeService) GetExternalService(ctx context.Context, id string) (*oauthserver.OAuthExternalService, error) {
	return s.ExpectedClient, s.ExpectedErr
}

func (s *FakeService) GetExternalServiceNames(ctx context.Context) ([]string, error) {
	return nil, nil
}

func (s *FakeService) RemoveExternalService(ctx context.Context, name string) error {
	return s.ExpectedErr
}

func (s *FakeService) HandleTokenRequest(rw http.ResponseWriter, req *http.Request) {}

func (s *FakeService) HandleIntrospectionRequest(rw http.ResponseWriter, req *http.Request) {}
