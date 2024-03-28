package auth

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins/pfs"
)

type ExternalService struct {
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
	PrivateKey   string `json:"privateKey"`
}

type ExternalServiceRegistry interface {
	HasExternalService(ctx context.Context, pluginID string) (bool, error)
	RegisterExternalService(ctx context.Context, pluginID string, pType pfs.Type, svc *pfs.IAM) (*ExternalService, error)
	RemoveExternalService(ctx context.Context, pluginID string) error
}
