package oasimpl

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/go-jose/go-jose/v3"
	"github.com/ory/fosite"
	"github.com/ory/fosite/compose"
	"github.com/ory/fosite/storage"
	"github.com/ory/fosite/token/jwt"
	"golang.org/x/crypto/bcrypt"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/slugify"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/extsvcauth"
	"github.com/grafana/grafana/pkg/services/extsvcauth/oauthserver"
	"github.com/grafana/grafana/pkg/services/extsvcauth/oauthserver/api"
	"github.com/grafana/grafana/pkg/services/extsvcauth/oauthserver/store"
	"github.com/grafana/grafana/pkg/services/extsvcauth/oauthserver/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	cacheExpirationTime  = 5 * time.Minute
	cacheCleanupInterval = 5 * time.Minute
)

type OAuth2ServiceImpl struct {
	cache         *localcache.CacheService
	memstore      *storage.MemoryStore
	cfg           *setting.Cfg
	sqlstore      oauthserver.Store
	oauthProvider fosite.OAuth2Provider
	logger        log.Logger
	accessControl ac.AccessControl
	acService     ac.Service
	saService     serviceaccounts.ExtSvcAccountsService
	userService   user.Service
	teamService   team.Service
	publicKey     any
}

func ProvideService(router routing.RouteRegister, bus bus.Bus, db db.DB, cfg *setting.Cfg,
	extSvcAccSvc serviceaccounts.ExtSvcAccountsService, accessControl ac.AccessControl, acSvc ac.Service, userSvc user.Service,
	teamSvc team.Service, keySvc signingkeys.Service, fmgmt *featuremgmt.FeatureManager) (*OAuth2ServiceImpl, error) {
	if !fmgmt.IsEnabledGlobally(featuremgmt.FlagExternalServiceAuth) {
		return nil, nil
	}
	config := &fosite.Config{
		AccessTokenLifespan: cfg.OAuth2ServerAccessTokenLifespan,
		TokenURL:            fmt.Sprintf("%voauth2/token", cfg.AppURL),
		AccessTokenIssuer:   cfg.AppURL,
		IDTokenIssuer:       cfg.AppURL,
		ScopeStrategy:       fosite.WildcardScopeStrategy,
	}

	s := &OAuth2ServiceImpl{
		cache:         localcache.New(cacheExpirationTime, cacheCleanupInterval),
		cfg:           cfg,
		accessControl: accessControl,
		acService:     acSvc,
		memstore:      storage.NewMemoryStore(),
		sqlstore:      store.NewStore(db),
		logger:        log.New("oauthserver"),
		userService:   userSvc,
		saService:     extSvcAccSvc,
		teamService:   teamSvc,
	}

	api := api.NewAPI(router, s)
	api.RegisterAPIEndpoints()

	bus.AddEventListener(s.handlePluginStateChanged)

	s.oauthProvider = newProvider(config, s, keySvc)

	return s, nil
}

func newProvider(config *fosite.Config, storage any, signingKeyService signingkeys.Service) fosite.OAuth2Provider {
	keyGetter := func(ctx context.Context) (any, error) {
		_, key, err := signingKeyService.GetOrCreatePrivateKey(ctx, signingkeys.ServerPrivateKeyID, jose.ES256)
		return key, err
	}
	return compose.Compose(
		config,
		storage,
		&compose.CommonStrategy{
			CoreStrategy: compose.NewOAuth2JWTStrategy(keyGetter, compose.NewOAuth2HMACStrategy(config), config),
			Signer:       &jwt.DefaultSigner{GetPrivateKey: keyGetter},
		},
		compose.OAuth2ClientCredentialsGrantFactory,
		compose.RFC7523AssertionGrantFactory,

		compose.OAuth2TokenIntrospectionFactory,
		compose.OAuth2TokenRevocationFactory,
	)
}

// HasExternalService returns whether an external service has been saved with that name.
func (s *OAuth2ServiceImpl) HasExternalService(ctx context.Context, name string) (bool, error) {
	client, errRetrieve := s.sqlstore.GetExternalServiceByName(ctx, name)
	if errRetrieve != nil && !errors.Is(errRetrieve, oauthserver.ErrClientNotFound) {
		return false, errRetrieve
	}

	return client != nil, nil
}

// GetExternalService retrieves an external service from store by client_id. It populates the SelfPermissions and
// SignedInUser from the associated service account.
// For performance reason, the service uses caching.
func (s *OAuth2ServiceImpl) GetExternalService(ctx context.Context, id string) (*oauthserver.OAuthExternalService, error) {
	entry, ok := s.cache.Get(id)
	if ok {
		client, ok := entry.(oauthserver.OAuthExternalService)
		if ok {
			s.logger.Debug("GetExternalService: cache hit", "id", id)
			return &client, nil
		}
	}

	client, err := s.sqlstore.GetExternalService(ctx, id)
	if err != nil {
		return nil, err
	}

	if err := s.setClientUser(ctx, client); err != nil {
		return nil, err
	}

	s.cache.Set(id, *client, cacheExpirationTime)
	return client, nil
}

// setClientUser sets the SignedInUser and SelfPermissions fields of the client
func (s *OAuth2ServiceImpl) setClientUser(ctx context.Context, client *oauthserver.OAuthExternalService) error {
	if client.ServiceAccountID == oauthserver.NoServiceAccountID {
		s.logger.Debug("GetExternalService: service has no service account, hence no permission", "client_id", client.ClientID, "name", client.Name)

		// Create a signed in user with no role and no permission
		client.SignedInUser = &user.SignedInUser{
			UserID:      oauthserver.NoServiceAccountID,
			OrgID:       oauthserver.TmpOrgID,
			Name:        client.Name,
			Permissions: map[int64]map[string][]string{oauthserver.TmpOrgID: {}},
		}
		return nil
	}

	s.logger.Debug("GetExternalService: fetch permissions", "client_id", client.ClientID)
	sa, err := s.saService.RetrieveExtSvcAccount(ctx, oauthserver.TmpOrgID, client.ServiceAccountID)
	if err != nil {
		s.logger.Error("GetExternalService: error fetching service account", "id", client.ClientID, "error", err)
		return err
	}
	client.SignedInUser = &user.SignedInUser{
		UserID:      sa.ID,
		OrgID:       oauthserver.TmpOrgID,
		OrgRole:     sa.Role,
		Login:       sa.Login,
		Name:        sa.Name,
		Permissions: map[int64]map[string][]string{},
	}
	client.SelfPermissions, err = s.acService.GetUserPermissions(ctx, client.SignedInUser, ac.Options{})
	if err != nil {
		s.logger.Error("GetExternalService: error fetching permissions", "client_id", client.ClientID, "error", err)
		return err
	}
	client.SignedInUser.Permissions[oauthserver.TmpOrgID] = ac.GroupScopesByAction(client.SelfPermissions)
	return nil
}

// GetExternalServiceNames get the names of External Service in store
func (s *OAuth2ServiceImpl) GetExternalServiceNames(ctx context.Context) ([]string, error) {
	s.logger.Debug("Get external service names from store")
	res, err := s.sqlstore.GetExternalServiceNames(ctx)
	if err != nil {
		s.logger.Error("Could not fetch clients from store", "error", err.Error())
		return nil, err
	}
	return res, nil
}

func (s *OAuth2ServiceImpl) RemoveExternalService(ctx context.Context, name string) error {
	s.logger.Info("Remove external service", "service", name)

	client, err := s.sqlstore.GetExternalServiceByName(ctx, name)
	if err != nil {
		if errors.Is(err, oauthserver.ErrClientNotFound) {
			s.logger.Debug("No external service linked to this name", "name", name)
			return nil
		}
		s.logger.Error("Error fetching external service", "name", name, "error", err.Error())
		return err
	}

	// Since we will delete the service, clear cache entry
	s.cache.Delete(client.ClientID)

	// Delete the OAuth client info in store
	if err := s.sqlstore.DeleteExternalService(ctx, client.ClientID); err != nil {
		s.logger.Error("Error deleting external service", "name", name, "error", err.Error())
		return err
	}
	s.logger.Debug("Deleted external service", "name", name, "client_id", client.ClientID)

	// Remove the associated service account
	return s.saService.RemoveExtSvcAccount(ctx, oauthserver.TmpOrgID, slugify.Slugify(name))
}

// SaveExternalService creates or updates an external service in the database, it generates client_id and secrets and
// it ensures that the associated service account has the correct permissions.
// Database consistency is not guaranteed, consider changing this in the future.
func (s *OAuth2ServiceImpl) SaveExternalService(ctx context.Context, registration *extsvcauth.ExternalServiceRegistration) (*extsvcauth.ExternalService, error) {
	if registration == nil {
		s.logger.Warn("RegisterExternalService called without registration")
		return nil, nil
	}
	slug := registration.Name
	s.logger.Info("Registering external service", "external service", slug)

	// Check if the client already exists in store
	client, errFetchExtSvc := s.sqlstore.GetExternalServiceByName(ctx, slug)
	if errFetchExtSvc != nil && !errors.Is(errFetchExtSvc, oauthserver.ErrClientNotFound) {
		s.logger.Error("Error fetching service", "external service", slug, "error", errFetchExtSvc)
		return nil, errFetchExtSvc
	}
	// Otherwise, create a new client
	if client == nil {
		s.logger.Debug("External service does not yet exist", "external service", slug)
		client = &oauthserver.OAuthExternalService{
			Name:             slug,
			ServiceAccountID: oauthserver.NoServiceAccountID,
			Audiences:        s.cfg.AppURL,
		}
	}

	// Parse registration form to compute required permissions for the client
	client.SelfPermissions, client.ImpersonatePermissions = s.handleRegistrationPermissions(registration)

	if registration.OAuthProviderCfg == nil {
		return nil, errors.New("missing oauth provider configuration")
	}

	if registration.OAuthProviderCfg.RedirectURI != nil {
		client.RedirectURI = *registration.OAuthProviderCfg.RedirectURI
	}

	var errGenCred error
	client.ClientID, client.Secret, errGenCred = s.genCredentials()
	if errGenCred != nil {
		s.logger.Error("Error generating credentials", "client", client.LogID(), "error", errGenCred)
		return nil, errGenCred
	}

	grantTypes := s.computeGrantTypes(registration.Self.Enabled, registration.Impersonation.Enabled)
	client.GrantTypes = strings.Join(grantTypes, ",")

	// Handle key options
	s.logger.Debug("Handle key options")
	keys, err := s.handleKeyOptions(ctx, registration.OAuthProviderCfg.Key)
	if err != nil {
		s.logger.Error("Error handling key options", "client", client.LogID(), "error", err)
		return nil, err
	}
	if keys != nil {
		client.PublicPem = []byte(keys.PublicPem)
	}
	dto := client.ToExternalService(keys)

	hashedSecret, err := bcrypt.GenerateFromPassword([]byte(client.Secret), bcrypt.DefaultCost)
	if err != nil {
		s.logger.Error("Error hashing secret", "client", client.LogID(), "error", err)
		return nil, err
	}
	client.Secret = string(hashedSecret)

	s.logger.Debug("Save service account")
	saID, errSaveServiceAccount := s.saService.ManageExtSvcAccount(ctx, &serviceaccounts.ManageExtSvcAccountCmd{
		ExtSvcSlug:  slugify.Slugify(client.Name),
		Enabled:     registration.Self.Enabled,
		OrgID:       oauthserver.TmpOrgID,
		Permissions: client.SelfPermissions,
	})
	if errSaveServiceAccount != nil {
		return nil, errSaveServiceAccount
	}
	client.ServiceAccountID = saID

	err = s.sqlstore.SaveExternalService(ctx, client)
	if err != nil {
		s.logger.Error("Error saving external service", "client", client.LogID(), "error", err)
		return nil, err
	}
	s.logger.Debug("Registered", "client", client.LogID())
	return dto, nil
}

// randString generates a a cryptographically secure random string of n bytes
func (s *OAuth2ServiceImpl) randString(n int) (string, error) {
	res := make([]byte, n)
	if _, err := rand.Read(res); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(res), nil
}

func (s *OAuth2ServiceImpl) genCredentials() (string, string, error) {
	id, err := s.randString(20)
	if err != nil {
		return "", "", err
	}
	// client_secret must be at least 32 bytes long
	secret, err := s.randString(32)
	if err != nil {
		return "", "", err
	}
	return id, secret, err
}

func (s *OAuth2ServiceImpl) computeGrantTypes(selfAccessEnabled, impersonationEnabled bool) []string {
	grantTypes := []string{}

	if selfAccessEnabled {
		grantTypes = append(grantTypes, string(fosite.GrantTypeClientCredentials))
	}

	if impersonationEnabled {
		grantTypes = append(grantTypes, string(fosite.GrantTypeJWTBearer))
	}

	return grantTypes
}

func (s *OAuth2ServiceImpl) handleKeyOptions(ctx context.Context, keyOption *extsvcauth.KeyOption) (*extsvcauth.KeyResult, error) {
	if keyOption == nil {
		return nil, fmt.Errorf("keyOption is nil")
	}

	var publicPem, privatePem string

	if keyOption.Generate {
		switch s.cfg.OAuth2ServerGeneratedKeyTypeForClient {
		case "RSA":
			privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
			if err != nil {
				return nil, err
			}
			publicPem = string(pem.EncodeToMemory(&pem.Block{
				Type:  "RSA PUBLIC KEY",
				Bytes: x509.MarshalPKCS1PublicKey(&privateKey.PublicKey),
			}))
			privatePem = string(pem.EncodeToMemory(&pem.Block{
				Type:  "RSA PRIVATE KEY",
				Bytes: x509.MarshalPKCS1PrivateKey(privateKey),
			}))
			s.logger.Debug("RSA key has been generated")
		default: // default to ECDSA
			privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
			if err != nil {
				return nil, err
			}
			publicDer, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
			if err != nil {
				return nil, err
			}

			privateDer, err := x509.MarshalPKCS8PrivateKey(privateKey)
			if err != nil {
				return nil, err
			}

			publicPem = string(pem.EncodeToMemory(&pem.Block{
				Type:  "PUBLIC KEY",
				Bytes: publicDer,
			}))
			privatePem = string(pem.EncodeToMemory(&pem.Block{
				Type:  "PRIVATE KEY",
				Bytes: privateDer,
			}))
			s.logger.Debug("ECDSA key has been generated")
		}

		return &extsvcauth.KeyResult{
			PrivatePem: privatePem,
			PublicPem:  publicPem,
			Generated:  true,
		}, nil
	}

	// TODO MVP allow specifying a URL to get the public key
	// if registration.Key.URL != "" {
	// 	return &oauthserver.KeyResult{
	// 		URL: registration.Key.URL,
	// 	}, nil
	// }

	if keyOption.PublicPEM != "" {
		pemEncoded, err := base64.StdEncoding.DecodeString(keyOption.PublicPEM)
		if err != nil {
			s.logger.Error("Cannot decode base64 encoded PEM string", "error", err)
		}
		_, err = utils.ParsePublicKeyPem(pemEncoded)
		if err != nil {
			s.logger.Error("Cannot parse PEM encoded string", "error", err)
			return nil, err
		}
		return &extsvcauth.KeyResult{
			PublicPem: string(pemEncoded),
		}, nil
	}

	return nil, fmt.Errorf("at least one key option must be specified")
}

// handleRegistrationPermissions parses the registration form to retrieve requested permissions and adds default
// permissions when impersonation is requested
func (*OAuth2ServiceImpl) handleRegistrationPermissions(registration *extsvcauth.ExternalServiceRegistration) ([]ac.Permission, []ac.Permission) {
	selfPermissions := registration.Self.Permissions
	impersonatePermissions := []ac.Permission{}

	if len(registration.Impersonation.Permissions) > 0 {
		requiredForToken := []ac.Permission{
			{Action: ac.ActionUsersRead, Scope: oauthserver.ScopeGlobalUsersSelf},
			{Action: ac.ActionUsersPermissionsRead, Scope: oauthserver.ScopeUsersSelf},
		}
		if registration.Impersonation.Groups {
			requiredForToken = append(requiredForToken, ac.Permission{Action: ac.ActionTeamsRead, Scope: oauthserver.ScopeTeamsSelf})
		}
		impersonatePermissions = append(requiredForToken, registration.Impersonation.Permissions...)
		selfPermissions = append(selfPermissions, ac.Permission{Action: ac.ActionUsersImpersonate, Scope: ac.ScopeUsersAll})
	}
	return selfPermissions, impersonatePermissions
}

// handlePluginStateChanged reset the client authorized grant_types according to the plugin state
func (s *OAuth2ServiceImpl) handlePluginStateChanged(ctx context.Context, event *pluginsettings.PluginStateChangedEvent) error {
	s.logger.Debug("Plugin state changed", "pluginId", event.PluginId, "enabled", event.Enabled)

	if event.OrgId != extsvcauth.TmpOrgID {
		s.logger.Debug("External Service not tied to this organization", "OrgId", event.OrgId)
		return nil
	}

	// Retrieve client associated to the plugin
	client, err := s.sqlstore.GetExternalServiceByName(ctx, event.PluginId)
	if err != nil {
		if errors.Is(err, oauthserver.ErrClientNotFound) {
			s.logger.Debug("No external service linked to this plugin", "pluginId", event.PluginId)
			return nil
		}
		s.logger.Error("Error fetching service", "pluginId", event.PluginId, "error", err.Error())
		return err
	}

	// Since we will change the grants, clear cache entry
	s.cache.Delete(client.ClientID)

	if !event.Enabled {
		// Plugin is disabled => remove all grant_types
		return s.sqlstore.UpdateExternalServiceGrantTypes(ctx, client.ClientID, "")
	}

	if err := s.setClientUser(ctx, client); err != nil {
		return err
	}

	// The plugin has self permissions (not only impersonate)
	canOnlyImpersonate := len(client.SelfPermissions) == 1 && (client.SelfPermissions[0].Action == ac.ActionUsersImpersonate)
	selfEnabled := len(client.SelfPermissions) > 0 && !canOnlyImpersonate
	// The plugin declared impersonate permissions
	impersonateEnabled := len(client.ImpersonatePermissions) > 0

	grantTypes := s.computeGrantTypes(selfEnabled, impersonateEnabled)

	return s.sqlstore.UpdateExternalServiceGrantTypes(ctx, client.ClientID, strings.Join(grantTypes, ","))
}
