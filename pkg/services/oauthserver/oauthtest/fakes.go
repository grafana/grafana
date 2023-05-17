package oauthtest

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/services/oauthserver"
	"gopkg.in/square/go-jose.v2"
)

type FakeService struct {
	ExpectedClient *oauthserver.Client
	ExpectedKey    *jose.JSONWebKey
	ExpectedErr    error
}

var _ oauthserver.OAuth2Service = &FakeService{}

func (s *FakeService) SaveExternalService(ctx context.Context, cmd *oauthserver.ExternalServiceRegistration) (*oauthserver.ClientDTO, error) {
	return s.ExpectedClient.ToDTO(), s.ExpectedErr
}

func (s *FakeService) GetExternalService(ctx context.Context, id string) (*oauthserver.Client, error) {
	return s.ExpectedClient, s.ExpectedErr
}

func (s *FakeService) HandleTokenRequest(rw http.ResponseWriter, req *http.Request) {}

func (s *FakeService) HandleIntrospectionRequest(rw http.ResponseWriter, req *http.Request) {}
