package auth

import (
	"context"
)

type ExternalService struct {
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
	PrivateKey   string `json:"privateKey"`
}

type IAM struct {
	Permissions []Permission `json:"permissions,omitempty"`
}

type Permission struct {
	Action string `json:"action"`
	Scope  string `json:"scope"`
}

type ExternalServiceRegistry interface {
	HasExternalService(ctx context.Context, pluginID string) (bool, error)
	RegisterExternalService(ctx context.Context, pluginID string, pType string, svc *IAM) (*ExternalService, error)
	RemoveExternalService(ctx context.Context, pluginID string) error
}
