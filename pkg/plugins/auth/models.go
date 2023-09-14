package auth

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins/plugindef"
)

type SecretType string

const (
	Bearer       SecretType = "Bearer"
	ClientSecret SecretType = "ClientSecret"
)

type ExternalService struct {
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
	PrivateKey   string `json:"privateKey"`
	SecretType   string `json:"SecretType"`
}

type ExternalServiceRegistry interface {
	RegisterExternalService(ctx context.Context, name string, svc *plugindef.ExternalServiceRegistration) (*ExternalService, error)
}
