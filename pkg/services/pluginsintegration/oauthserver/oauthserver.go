package oauthserver

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins/oauth"
	"github.com/grafana/grafana/pkg/services/oauthserver"
)

type Service struct {
	os oauthserver.OAuth2Server
}

func ProvideService(os oauthserver.OAuth2Server) *Service {
	s := &Service{
		os: os,
	}
	return s
}

// SavePluginExternalService is a simplified wrapper around SaveExternalService for the plugin use case.
func (s *Service) SavePluginExternalService(ctx context.Context, svcName string, svc *oauth.PluginExternalService) (*oauth.PluginExternalServiceRegistration, error) {
	extSvc, err := s.os.SaveExternalService(ctx, &oauthserver.ExternalServiceRegistration{
		Name: svcName,
		Impersonation: oauthserver.ImpersonationCfg{
			Enabled:     true,
			Groups:      true,
			Permissions: svc.ImpersonationPermissions,
		},
		Self: oauthserver.SelfCfg{
			Enabled:     true,
			Permissions: svc.SelfPermissions,
		},
		Key: &oauthserver.KeyOption{Generate: true},
	})
	if err != nil {
		return nil, err
	}

	return &oauth.PluginExternalServiceRegistration{
		ClientID:     extSvc.ID,
		ClientSecret: extSvc.Secret,
		PrivateKey:   extSvc.KeyResult.PrivatePem,
	}, nil
}
