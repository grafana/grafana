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

	"github.com/ory/fosite"
	"github.com/ory/fosite/compose"
	"github.com/ory/fosite/storage"
	"github.com/ory/fosite/token/jwt"
	"golang.org/x/crypto/bcrypt"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/models/roletype"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/oauthserver"
	"github.com/grafana/grafana/pkg/services/oauthserver/api"
	"github.com/grafana/grafana/pkg/services/oauthserver/store"
	"github.com/grafana/grafana/pkg/services/oauthserver/utils"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
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
	saService     serviceaccounts.Service
	userService   user.Service
	teamService   team.Service
	publicKey     interface{}
}

func ProvideService(router routing.RouteRegister, db db.DB, cfg *setting.Cfg,
	svcAccSvc serviceaccounts.Service, accessControl ac.AccessControl, acSvc ac.Service, userSvc user.Service,
	teamSvc team.Service, keySvc signingkeys.Service, fmgmt *featuremgmt.FeatureManager) (*OAuth2ServiceImpl, error) {
	if !fmgmt.IsEnabled(featuremgmt.FlagExternalServiceAuth) {
		return nil, nil
	}
	config := &fosite.Config{
		AccessTokenLifespan: cfg.OAuth2ServerAccessTokenLifespan,
		TokenURL:            fmt.Sprintf("%voauth2/token", cfg.AppURL),
		AccessTokenIssuer:   cfg.AppURL,
		IDTokenIssuer:       cfg.AppURL,
		ScopeStrategy:       fosite.WildcardScopeStrategy,
	}

	privateKey := keySvc.GetServerPrivateKey()

	var publicKey interface{}
	switch k := privateKey.(type) {
	case *rsa.PrivateKey:
		publicKey = &k.PublicKey
	case *ecdsa.PrivateKey:
		publicKey = &k.PublicKey
	default:
		return nil, fmt.Errorf("unknown private key type %T", k)
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
		saService:     svcAccSvc,
		teamService:   teamSvc,
		publicKey:     publicKey,
	}

	api := api.NewAPI(router, s)
	api.RegisterAPIEndpoints()

	s.oauthProvider = newProvider(config, s, privateKey)

	return s, nil
}

func newProvider(config *fosite.Config, storage interface{}, key interface{}) fosite.OAuth2Provider {
	keyGetter := func(context.Context) (interface{}, error) {
		return key, nil
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

// GetExternalService retrieves an external service from store by client_id. It populates the SelfPermissions and
// SignedInUser from the associated service account.
// For performance reason, the service uses caching.
func (s *OAuth2ServiceImpl) GetExternalService(ctx context.Context, id string) (*oauthserver.ExternalService, error) {
	entry, ok := s.cache.Get(id)
	if ok {
		client, ok := entry.(oauthserver.ExternalService)
		if ok {
			s.logger.Debug("GetExternalService: cache hit", "id", id)
			return &client, nil
		}
	}

	client, err := s.sqlstore.GetExternalService(ctx, id)
	if err != nil {
		return nil, err
	}

	// Handle the case where the external service has no service account
	if client.ServiceAccountID == oauthserver.NoServiceAccountID {
		s.logger.Debug("GetExternalService: service has no service account, hence no permission", "id", id, "name", client.Name)
		// Create a signed in user with no role and no permissions
		client.SignedInUser = &user.SignedInUser{
			UserID:      oauthserver.NoServiceAccountID,
			OrgID:       oauthserver.TmpOrgID,
			Name:        client.Name,
			Permissions: map[int64]map[string][]string{oauthserver.TmpOrgID: {}},
		}
		s.cache.Set(id, *client, cacheExpirationTime)
		return client, nil
	}

	// Retrieve self permissions and generate a signed in user
	s.logger.Debug("GetExternalService: fetch permissions", "client id", id)
	sa, err := s.saService.RetrieveServiceAccount(ctx, oauthserver.TmpOrgID, client.ServiceAccountID)
	if err != nil {
		s.logger.Error("GetExternalService: error fetching service account", "id", id, "error", err)
		return nil, err
	}
	client.SignedInUser = &user.SignedInUser{
		UserID:      sa.Id,
		OrgID:       oauthserver.TmpOrgID,
		OrgRole:     org.RoleType(sa.Role), // Need this to compute the permissions in OSS
		Login:       sa.Login,
		Name:        sa.Name,
		Permissions: map[int64]map[string][]string{},
	}
	client.SelfPermissions, err = s.acService.GetUserPermissions(ctx, client.SignedInUser, ac.Options{})
	if err != nil {
		s.logger.Error("GetExternalService: error fetching permissions", "id", id, "error", err)
		return nil, err
	}
	client.SignedInUser.Permissions[oauthserver.TmpOrgID] = ac.GroupScopesByAction(client.SelfPermissions)

	s.cache.Set(id, *client, cacheExpirationTime)
	return client, nil
}

// SaveExternalService creates or updates an external service in the database, it generates client_id and secrets and
// it ensures that the associated service account has the correct permissions.
// Database consistency is not guaranteed, consider changing this in the future.
func (s *OAuth2ServiceImpl) SaveExternalService(ctx context.Context, registration *oauthserver.ExternalServiceRegistration) (*oauthserver.ExternalServiceDTO, error) {
	if registration == nil {
		s.logger.Warn("RegisterExternalService called without registration")
		return nil, nil
	}
	s.logger.Info("Registering external service", "external service name", registration.Name)

	// Check if the client already exists in store
	client, errFetchExtSvc := s.sqlstore.GetExternalServiceByName(ctx, registration.Name)
	if errFetchExtSvc != nil {
		var srcError errutil.Error
		if errors.As(errFetchExtSvc, &srcError) {
			if srcError.MessageID != oauthserver.ErrClientNotFoundMessageID {
				s.logger.Error("Error fetching service", "external service", registration.Name, "error", errFetchExtSvc)
				return nil, errFetchExtSvc
			}
		}
	}
	// Otherwise, create a new client
	if client == nil {
		s.logger.Debug("External service does not yet exist", "external service name", registration.Name)
		client = &oauthserver.ExternalService{
			Name:             registration.Name,
			ServiceAccountID: oauthserver.NoServiceAccountID,
			Audiences:        s.cfg.AppURL,
		}
	}

	// Parse registration form to compute required permissions for the client
	client.SelfPermissions, client.ImpersonatePermissions = s.handleRegistrationPermissions(registration)

	if registration.RedirectURI != nil {
		client.RedirectURI = *registration.RedirectURI
	}

	var errGenCred error
	client.ClientID, client.Secret, errGenCred = s.genCredentials()
	if errGenCred != nil {
		s.logger.Error("Error generating credentials", "client", client.LogID(), "error", errGenCred)
		return nil, errGenCred
	}

	s.logger.Debug("Save service account")
	saID, errSaveServiceAccount := s.saveServiceAccount(ctx, client.Name, client.ServiceAccountID, client.SelfPermissions)
	if errSaveServiceAccount != nil {
		return nil, errSaveServiceAccount
	}
	client.ServiceAccountID = saID

	grantTypes := s.computeGrantTypes(registration.Self.Enabled, registration.Impersonation.Enabled)
	client.GrantTypes = strings.Join(grantTypes, ",")

	// Handle key options
	s.logger.Debug("Handle key options")
	keys, err := s.handleKeyOptions(ctx, registration.Key)
	if err != nil {
		s.logger.Error("Error handling key options", "client", client.LogID(), "error", err)
		return nil, err
	}
	if keys != nil {
		client.PublicPem = []byte(keys.PublicPem)
	}
	dto := client.ToDTO()
	dto.KeyResult = keys

	hashedSecret, err := bcrypt.GenerateFromPassword([]byte(client.Secret), bcrypt.DefaultCost)
	if err != nil {
		s.logger.Error("Error hashing secret", "client", client.LogID(), "error", err)
		return nil, err
	}
	client.Secret = string(hashedSecret)

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

func (s *OAuth2ServiceImpl) handleKeyOptions(ctx context.Context, keyOption *oauthserver.KeyOption) (*oauthserver.KeyResult, error) {
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

		return &oauthserver.KeyResult{
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
			s.logger.Error("cannot decode base64 encoded PEM string", "error", err)
		}
		_, err = utils.ParsePublicKeyPem(pemEncoded)
		if err != nil {
			s.logger.Error("cannot parse PEM encoded string", "error", err)
			return nil, err
		}
		return &oauthserver.KeyResult{
			PublicPem: string(pemEncoded),
		}, nil
	}

	return nil, fmt.Errorf("at least one key option must be specified")
}

// saveServiceAccount creates a service account if the service account ID is NoServiceAccountID, otherwise it updates the service account's permissions
func (s *OAuth2ServiceImpl) saveServiceAccount(ctx context.Context, extSvcName string, saID int64, permissions []ac.Permission) (int64, error) {
	if saID == oauthserver.NoServiceAccountID {
		// Create a service account
		s.logger.Debug("Create service account", "external service name", extSvcName)
		return s.createServiceAccount(ctx, extSvcName, permissions)
	}

	// check if the service account exists
	s.logger.Debug("Update service account", "external service name", extSvcName)
	sa, err := s.saService.RetrieveServiceAccount(ctx, oauthserver.TmpOrgID, saID)
	if err != nil {
		s.logger.Error("Error retrieving service account", "external service name", extSvcName, "error", err)
		return oauthserver.NoServiceAccountID, err
	}

	// update the service account's permissions
	if len(permissions) > 0 {
		s.logger.Debug("Update role permissions", "external service name", extSvcName, "saID", saID)
		if err := s.acService.SaveExternalServiceRole(ctx, ac.SaveExternalServiceRoleCommand{
			OrgID:             ac.GlobalOrgID,
			Global:            true,
			ExternalServiceID: extSvcName,
			ServiceAccountID:  sa.Id,
			Permissions:       permissions,
		}); err != nil {
			return oauthserver.NoServiceAccountID, err
		}
		return saID, nil
	}

	// remove the service account
	errDelete := s.deleteServiceAccount(ctx, extSvcName, sa.Id)
	return oauthserver.NoServiceAccountID, errDelete
}

// deleteServiceAccount deletes a service account by ID and removes its associated role
func (s *OAuth2ServiceImpl) deleteServiceAccount(ctx context.Context, extSvcName string, saID int64) error {
	s.logger.Debug("Delete service account", "external service name", extSvcName, "saID", saID)
	if err := s.saService.DeleteServiceAccount(ctx, oauthserver.TmpOrgID, saID); err != nil {
		return err
	}
	return s.acService.DeleteExternalServiceRole(ctx, extSvcName)
}

// createServiceAccount creates a service account with the given permissions and returns the ID of the service account
// When no permission is given, the account isn't created and NoServiceAccountID is returned
// This first design does not use a single transaction for the whole service account creation process => database consistency is not guaranteed.
// Consider changing this in the future.
func (s *OAuth2ServiceImpl) createServiceAccount(ctx context.Context, extSvcName string, permissions []ac.Permission) (int64, error) {
	if len(permissions) == 0 {
		// No permission, no service account
		s.logger.Debug("No permission, no service account", "external service name", extSvcName)
		return oauthserver.NoServiceAccountID, nil
	}

	newRole := func(r roletype.RoleType) *roletype.RoleType {
		return &r
	}
	newBool := func(b bool) *bool {
		return &b
	}

	slug := slugify.Slugify(extSvcName)

	s.logger.Debug("Generate service account", "external service name", extSvcName, "orgID", oauthserver.TmpOrgID, "name", slug)
	sa, err := s.saService.CreateServiceAccount(ctx, oauthserver.TmpOrgID, &serviceaccounts.CreateServiceAccountForm{
		Name:       slug,
		Role:       newRole(roletype.RoleViewer), // FIXME: Use empty role
		IsDisabled: newBool(false),
	})
	if err != nil {
		return oauthserver.NoServiceAccountID, err
	}

	s.logger.Debug("create tailored role for service account", "external service name", extSvcName, "name", slug, "service_account_id", sa.Id, "permissions", permissions)
	if err := s.acService.SaveExternalServiceRole(ctx, ac.SaveExternalServiceRoleCommand{
		OrgID:             ac.GlobalOrgID,
		Global:            true,
		ExternalServiceID: slug,
		ServiceAccountID:  sa.Id,
		Permissions:       permissions,
	}); err != nil {
		return oauthserver.NoServiceAccountID, err
	}

	return sa.Id, nil
}

// handleRegistrationPermissions parses the registration form to retrieve requested permissions and adds default
// permissions when impersonation is requested
func (*OAuth2ServiceImpl) handleRegistrationPermissions(registration *oauthserver.ExternalServiceRegistration) ([]ac.Permission, []ac.Permission) {
	selfPermissions := []ac.Permission{}
	impersonatePermissions := []ac.Permission{}

	if registration.Self.Enabled {
		selfPermissions = append(selfPermissions, registration.Self.Permissions...)
	}
	if registration.Impersonation.Enabled {
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
