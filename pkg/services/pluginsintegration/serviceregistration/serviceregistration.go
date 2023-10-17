package serviceregistration

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins/auth"
	"github.com/grafana/grafana/pkg/plugins/plugindef"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/extsvcauth"
)

type Service struct {
	os extsvcauth.ExternalServiceRegistry
}

func ProvideService(os extsvcauth.ExternalServiceRegistry) *Service {
	s := &Service{
		os: os,
	}
	return s
}

// RegisterExternalService is a simplified wrapper around SaveExternalService for the plugin use case.
func (s *Service) RegisterExternalService(ctx context.Context, svcName string, svc *plugindef.ExternalServiceRegistration) (*auth.ExternalService, error) {
	impersonation := extsvcauth.ImpersonationCfg{}
	if svc.Impersonation != nil {
		impersonation.Permissions = toAccessControlPermissions(svc.Impersonation.Permissions)
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
	}

	self := extsvcauth.SelfCfg{}
	if len(svc.Permissions) > 0 {
		self.Permissions = toAccessControlPermissions(svc.Permissions)
		self.Enabled = true
	}

	registration := &extsvcauth.ExternalServiceRegistration{
		Name:          svcName,
		Impersonation: impersonation,
		Self:          self,
	}

	// Default authProvider now is ServiceAccounts
	registration.AuthProvider = extsvcauth.ServiceAccounts
	if svc.Impersonation != nil {
		registration.AuthProvider = extsvcauth.OAuth2Server
		registration.OAuthProviderCfg = &extsvcauth.OAuthProviderCfg{Key: &extsvcauth.KeyOption{Generate: true}}
	}

	extSvc, err := s.os.SaveExternalService(ctx, registration)
	if err != nil || extSvc == nil {
		return nil, err
	}

	privateKey := ""
	if extSvc.OAuthExtra != nil {
		privateKey = extSvc.OAuthExtra.KeyResult.PrivatePem
	}

	return &auth.ExternalService{
		ClientID:     extSvc.ID,
		ClientSecret: extSvc.Secret,
		PrivateKey:   privateKey}, nil
}

func toAccessControlPermissions(ps []plugindef.Permission) []accesscontrol.Permission {
	res := make([]accesscontrol.Permission, 0, len(ps))
	for _, p := range ps {
		scope := ""
		if p.Scope != nil {
			scope = *p.Scope
		}
		res = append(res, accesscontrol.Permission{
			Action: p.Action,
			Scope:  scope,
		})
	}
	return res
}
