package serviceregistration

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/plugins/auth"
	"github.com/grafana/grafana/pkg/plugins/plugindef"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/extsvcauth"
	"github.com/grafana/grafana/pkg/services/extsvcauth/oauthserver"
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
	if svc.Self != nil {
		self.Permissions = toAccessControlPermissions(svc.Self.Permissions)
		if svc.Self.Enabled != nil {
			self.Enabled = *svc.Self.Enabled
		} else {
			self.Enabled = true
		}
	}

	extSvc, err := s.os.SaveExternalService(ctx, &extsvcauth.ExternalServiceRegistration{
		Name:            svcName,
		Impersonation:   impersonation,
		Self:            self,
		AuthProvider:    extsvcauth.OAuth2Server,
		AuthProviderCfg: oauthserver.ProviderCfg{Key: &oauthserver.KeyOption{Generate: true}},
	})
	if err != nil {
		return nil, err
	}

	dto := &auth.ExternalService{ClientID: extSvc.ID, ClientSecret: extSvc.Secret}

	extSvcExtra, ok := extSvc.Extra.(oauthserver.ExternalServiceDTOExtra)
	if !ok {
		return nil, errors.New("could not parse dto extra config")
	}
	dto.PrivateKey = extSvcExtra.KeyResult.PrivatePem

	return dto, nil
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
