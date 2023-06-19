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
	impersonation := oauthserver.ImpersonationCfg{
		Permissions: svc.Impersonation.Permissions,
	}
	if svc.Impersonation.Enabled != nil {
		impersonation.Enabled = *svc.Impersonation.Enabled
	} else {
		impersonation.Enabled = true
	}
	if svc.Impersonation.Groups != nil {
		impersonation.Groups = *svc.Impersonation.Groups
	} else {
		impersonation.Groups = true
	}
	self := oauthserver.SelfCfg{
		Permissions: svc.Self.Permissions,
	}
	if svc.Self.Enabled != nil {
		self.Enabled = *svc.Self.Enabled
	} else {
		self.Enabled = true
	}
	extSvc, err := s.os.SaveExternalService(ctx, &oauthserver.ExternalServiceRegistration{
		Name:          svcName,
		Impersonation: impersonation,
		Self:          self,
		Key:           &oauthserver.KeyOption{Generate: true},
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
