package service

import (
	"context"
	"errors"
	"fmt"
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
	"github.com/grafana/grafana/pkg/util"
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

	if s.features.IsEnabledGlobally(featuremgmt.FlagSsoSettingsLDAP) {
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

	// calculate MinTLSVersionID and TLSCipherIDs from input text values
	// also initialize Timeout and OrgID from group mappings with default values if they are not configured
	for _, server := range ldapCfg.Servers {
		if server.MinTLSVersion != "" {
			server.MinTLSVersionID, err = util.TlsNameToVersion(server.MinTLSVersion)
			if err != nil {
				s.log.Error("failed to set min TLS version, ignoring", "err", err, "server", server.Host)
			}
		}

		if len(server.TLSCiphers) > 0 {
			server.TLSCipherIDs, err = util.TlsCiphersToIDs(server.TLSCiphers)
			if err != nil {
				s.log.Error("unrecognized TLS Cipher(s), ignoring", "err", err, "server", server.Host)
			}
		}

		for _, groupMap := range server.Groups {
			if groupMap.OrgId == 0 {
				groupMap.OrgId = 1
			}
		}

		if server.Timeout == 0 {
			server.Timeout = ldap.DefaultTimeout
		}
	}

	s.loadingMutex.Lock()
	defer s.loadingMutex.Unlock()

	s.cfg = cfg
	s.ldapCfg = ldapCfg
	s.client = multildap.New(s.ldapCfg.Servers, s.cfg)

	return nil
}

func (s *LDAPImpl) Validate(ctx context.Context, settings models.SSOSettings, oldSettings models.SSOSettings, requester identity.Requester) error {
	ldapCfg, err := resolveServerConfig(settings.Settings["config"])
	if err != nil {
		return err
	}

	enabled := resolveBool(settings.Settings["enabled"], false)
	if !enabled {
		return nil
	}

	if len(ldapCfg.Servers) == 0 {
		return fmt.Errorf("no servers configured for LDAP")
	}

	for i, server := range ldapCfg.Servers {
		// host is required for every LDAP server config
		if server.Host == "" {
			return fmt.Errorf("no host configured for server with index %d", i)
		}

		if server.SearchFilter == "" {
			return fmt.Errorf("no search filter configured for server with index %d", i)
		}

		if len(server.SearchBaseDNs) == 0 {
			return fmt.Errorf("no search base DN configured for server with index %d", i)
		}

		if server.MinTLSVersion != "" {
			_, err = util.TlsNameToVersion(server.MinTLSVersion)
			if err != nil {
				return fmt.Errorf("invalid min TLS version configured for server with index %d", i)
			}
		}

		if len(server.TLSCiphers) > 0 {
			_, err = util.TlsCiphersToIDs(server.TLSCiphers)
			if err != nil {
				return fmt.Errorf("invalid TLS ciphers configured for server with index %d", i)
			}
		}

		for _, groupMap := range server.Groups {
			if groupMap.OrgRole == "" && groupMap.IsGrafanaAdmin == nil {
				return fmt.Errorf("organization role or Grafana admin status is required in group mappings for server with index %d", i)
			}
		}
	}

	return nil
}

func (s *LDAPImpl) ReloadConfig() error {
	if !s.cfg.Enabled {
		return nil
	}

	s.loadingMutex.Lock()
	defer s.loadingMutex.Unlock()

	config, err := ldap.GetConfig(s.cfg)
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
