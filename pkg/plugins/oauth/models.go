package oauth

import (
	"context"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type PluginExternalService struct {
	SelfPermissions          []accesscontrol.Permission `json:"selfPermissions,omitempty"`
	ImpersonationPermissions []accesscontrol.Permission `json:"impersonationPermissions,omitempty"`
}

type PluginExternalServiceRegistration struct {
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
	PrivateKey   string `json:"privateKey"`
}

type ExternalServiceRegister interface {
	SavePluginExternalService(ctx context.Context, name string, svc *PluginExternalService) (*PluginExternalServiceRegistration, error)
}
