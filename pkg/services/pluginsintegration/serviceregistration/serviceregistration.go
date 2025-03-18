package serviceregistration

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/auth"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/extsvcauth"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	featureEnabled bool
	log            log.Logger
	reg            extsvcauth.ExternalServiceRegistry
	settingsSvc    pluginsettings.Service
}

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, reg extsvcauth.ExternalServiceRegistry, settingsSvc pluginsettings.Service) *Service {
	enabled := features.IsEnabledGlobally(featuremgmt.FlagExternalServiceAccounts) && cfg.ManagedServiceAccountsEnabled
	s := &Service{
		featureEnabled: enabled,
		log:            log.New("plugins.external.registration"),
		reg:            reg,
		settingsSvc:    settingsSvc,
	}
	return s
}

func (s *Service) HasExternalService(ctx context.Context, pluginID string) (bool, error) {
	if !s.featureEnabled {
		s.log.Debug("Skipping HasExternalService call. The feature is behind a feature toggle and needs to be enabled.")
		return false, nil
	}

	return s.reg.HasExternalService(ctx, pluginID)
}

// RegisterExternalService is a simplified wrapper around SaveExternalService for the plugin use case.
func (s *Service) RegisterExternalService(ctx context.Context, pluginID string, pType string, svc *auth.IAM) (*auth.ExternalService, error) {
	ctxLogger := s.log.FromContext(ctx)

	if !s.featureEnabled {
		ctxLogger.Warn("Skipping External Service Registration. The feature is behind a feature toggle and needs to be enabled.")
		return nil, nil
	}

	// Datasource plugins can only be enabled
	enabled := true
	// App plugins can be disabled
	if pType == string(plugins.TypeApp) {
		settings, err := s.settingsSvc.GetPluginSettingByPluginID(ctx, &pluginsettings.GetByPluginIDArgs{PluginID: pluginID})
		if err != nil && !errors.Is(err, pluginsettings.ErrPluginSettingNotFound) {
			return nil, err
		}

		enabled = (settings != nil) && settings.Enabled
	}
	self := extsvcauth.SelfCfg{}
	self.Enabled = enabled
	if len(svc.Permissions) > 0 {
		self.Permissions = toAccessControlPermissions(svc.Permissions)
	}

	registration := &extsvcauth.ExternalServiceRegistration{
		Name:         pluginID,
		Self:         self,
		AuthProvider: extsvcauth.ServiceAccounts,
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

func toAccessControlPermissions(ps []auth.Permission) []accesscontrol.Permission {
	res := make([]accesscontrol.Permission, 0, len(ps))
	for _, p := range ps {
		res = append(res, accesscontrol.Permission{
			Action: p.Action,
			Scope:  p.Scope,
		})
	}
	return res
}

// RemoveExternalService removes the external service account associated to a plugin
func (s *Service) RemoveExternalService(ctx context.Context, pluginID string) error {
	if !s.featureEnabled {
		s.log.Debug("Skipping External Service Removal. The feature is behind a feature toggle and needs to be enabled.")
		return nil
	}

	return s.reg.RemoveExternalService(ctx, pluginID)
}
