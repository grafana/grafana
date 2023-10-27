package serviceregistration

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/plugins/auth"
	"github.com/grafana/grafana/pkg/plugins/plugindef"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/extsvcauth"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
)

type Service struct {
	reg         extsvcauth.ExternalServiceRegistry
	settingsSvc pluginsettings.Service
}

func ProvideService(reg extsvcauth.ExternalServiceRegistry, settingsSvc pluginsettings.Service) *Service {
	s := &Service{
		reg:         reg,
		settingsSvc: settingsSvc,
	}
	return s
}

// RegisterExternalService is a simplified wrapper around SaveExternalService for the plugin use case.
func (s *Service) RegisterExternalService(ctx context.Context, svcName string, pType plugindef.Type, svc *plugindef.ExternalServiceRegistration) (*auth.ExternalService, error) {
	// Datasource plugins can only be enabled
	enabled := true
	// App plugins can be disabled
	if pType == plugindef.TypeApp {
		settings, err := s.settingsSvc.GetPluginSettingByPluginID(ctx, &pluginsettings.GetByPluginIDArgs{PluginID: svcName})
		if err != nil && !errors.Is(err, pluginsettings.ErrPluginSettingNotFound) {
			return nil, err
		}

		enabled = (settings != nil) && settings.Enabled
	}

	impersonation := extsvcauth.ImpersonationCfg{}
	if svc.Impersonation != nil {
		impersonation.Permissions = toAccessControlPermissions(svc.Impersonation.Permissions)
		impersonation.Enabled = enabled
		if svc.Impersonation.Groups != nil {
			impersonation.Groups = *svc.Impersonation.Groups
		} else {
			impersonation.Groups = true
		}
	}

	self := extsvcauth.SelfCfg{}
	self.Enabled = enabled
	if len(svc.Permissions) > 0 {
		self.Permissions = toAccessControlPermissions(svc.Permissions)
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

	extSvc, err := s.reg.SaveExternalService(ctx, registration)
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
