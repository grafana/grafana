package oauth

import (
	"context"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// SelfCfg is a subset of oauthserver.SelfCfg making some fields optional
type SelfCfg struct {
	Enabled     *bool                      `json:"enabled,omitempty"`
	Permissions []accesscontrol.Permission `json:"permissions,omitempty"`
}

// ImpersonationCfg is a subset of oauthserver.ImpersonationCfg making some fields optional
type ImpersonationCfg struct {
	Enabled     *bool                      `json:"enabled,omitempty"`
	Groups      *bool                      `json:"groups,omitempty"`
	Permissions []accesscontrol.Permission `json:"permissions,omitempty"`
}

// PluginExternalServiceRegistration is a subset of oauthserver.ExternalServiceRegistration
// simplified for the plugin use case.
type PluginExternalService struct {
	Impersonation ImpersonationCfg `json:"impersonation"`
	Self          SelfCfg          `json:"self"`
}

type PluginExternalServiceRegistration struct {
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
	PrivateKey   string `json:"privateKey"`
}

type ExternalServiceRegister interface {
	SavePluginExternalService(ctx context.Context, name string, svc *PluginExternalService) (*PluginExternalServiceRegistration, error)
}
