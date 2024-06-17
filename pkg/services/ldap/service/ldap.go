package service

import (
	"context"
	"errors"
	"sync"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/ldap/multildap"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	ErrUnableToCreateLDAPClient = errors.New("unable to create LDAP client")
	ErrLDAPNotEnabled           = errors.New("LDAP not enabled")
)

// LDAP is the interface for the LDAP service.
type LDAP interface {
	ReloadConfig() error
	Config() *ldap.ServersConfig
	Client() multildap.IMultiLDAP

	// Login authenticates the user against the LDAP server.
	Login(query *login.LoginUserQuery) (*login.ExternalUserInfo, error)
	// User searches for a user in the LDAP server.
	User(username string) (*login.ExternalUserInfo, error)
}

type LDAPImpl struct {
	client      multildap.IMultiLDAP
	cfg         *ldap.Config
	ldapCfg     *ldap.ServersConfig
	log         log.Logger
	features    featuremgmt.FeatureToggles
	ssoSettings ssosettings.Service

	// loadingMutex locks the reading of the config so multiple requests for reloading are sequential.
	loadingMutex *sync.Mutex
}

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, ssoSettings ssosettings.Service) *LDAPImpl {
	s := &LDAPImpl{
		log:          log.New("ldap.service"),
		loadingMutex: &sync.Mutex{},
		features:     features,
		ssoSettings:  ssoSettings,
	}

	if s.features.IsEnabledGlobally(featuremgmt.FlagSsoSettingsApi) && s.features.IsEnabledGlobally(featuremgmt.FlagSsoSettingsLDAP) {
		s.ssoSettings.RegisterReloadable(social.LDAPProviderName, s)

		ldapSettings, err := s.ssoSettings.GetForProvider(context.Background(), social.LDAPProviderName)
		if err != nil {
			s.log.Error("Failed to retrieve LDAP settings from SSO settings service", "error", err)
			return s
		}

		err = s.Reload(context.Background(), *ldapSettings)
		if err != nil {
			s.log.Error("Failed to load LDAP settings", "error", err)
			return s
		}
	} else {
		s.cfg = ldap.GetLDAPConfig(cfg)
		if !cfg.LDAPAuthEnabled {
			return s
		}

		ldapCfg, err := multildap.GetConfig(s.cfg)
		if err != nil {
			s.log.Error("Failed to get LDAP config", "error", err)
		} else {
			s.ldapCfg = ldapCfg
			s.client = multildap.New(s.ldapCfg.Servers, s.cfg)
		}
	}

	return s
}

func (s *LDAPImpl) Reload(ctx context.Context, settings models.SSOSettings) error {
	cfg := &ldap.Config{}
	cfg.Enabled = resolveBool(settings.Settings["enabled"], false)
	cfg.SkipOrgRoleSync = resolveBool(settings.Settings["skip_org_role_sync"], false)
	cfg.AllowSignUp = resolveBool(settings.Settings["allow_sign_up"], true)

	ldapCfg, err := resolveServerConfig(settings.Settings["config"])
	if err != nil {
		return err
	}

	s.loadingMutex.Lock()
	defer s.loadingMutex.Unlock()

	s.cfg = cfg
	s.ldapCfg = ldapCfg
	s.client = multildap.New(s.ldapCfg.Servers, s.cfg)

	return nil
}

func (s *LDAPImpl) Validate(ctx context.Context, settings models.SSOSettings, oldSettings models.SSOSettings, requester identity.Requester) error {
	return nil
}

func (s *LDAPImpl) ReloadConfig() error {
	if !s.cfg.Enabled {
		return nil
	}

	s.loadingMutex.Lock()
	defer s.loadingMutex.Unlock()

	config, err := readConfig(s.cfg.ConfigFilePath)
	if err != nil {
		return err
	}

	client := multildap.New(config.Servers, s.cfg)
	if client == nil {
		return ErrUnableToCreateLDAPClient
	}

	s.ldapCfg = config
	s.client = client

	return nil
}

func (s *LDAPImpl) Client() multildap.IMultiLDAP {
	return s.client
}

func (s *LDAPImpl) Config() *ldap.ServersConfig {
	return s.ldapCfg
}

func (s *LDAPImpl) Login(query *login.LoginUserQuery) (*login.ExternalUserInfo, error) {
	if !s.cfg.Enabled {
		return nil, ErrLDAPNotEnabled
	}

	client := s.Client()
	if client == nil {
		return nil, ErrUnableToCreateLDAPClient
	}

	return client.Login(query)
}

func (s *LDAPImpl) User(username string) (*login.ExternalUserInfo, error) {
	if !s.cfg.Enabled {
		return nil, ErrLDAPNotEnabled
	}

	client := s.Client()
	if client == nil {
		return nil, ErrUnableToCreateLDAPClient
	}

	user, _, err := client.User(username)
	return user, err
}
