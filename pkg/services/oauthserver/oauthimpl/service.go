package oauthimpl

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"strings"
	"time"

	"github.com/ory/fosite"
	"github.com/ory/fosite/compose"
	"github.com/ory/fosite/storage"
	"github.com/ory/fosite/token/jwt"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/models/roletype"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/oauthserver"
	"github.com/grafana/grafana/pkg/services/oauthserver/api"
	"github.com/grafana/grafana/pkg/services/oauthserver/oauthstore"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
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
	sqlstore      oauthstore.Store
	oauthProvider fosite.OAuth2Provider
	logger        log.Logger
	accessControl ac.AccessControl
	acService     ac.Service
	saService     serviceaccounts.Service
	userService   user.Service
	teamService   team.Service
	publicKey     *rsa.PublicKey
}

func ProvideService(router routing.RouteRegister, db db.DB, cfg *setting.Cfg, skv kvstore.SecretsKVStore,
	svcAccSvc serviceaccounts.Service, accessControl ac.AccessControl, acSvc ac.Service, userSvc user.Service,
	teamSvc team.Service) (*OAuth2ServiceImpl, error) {

	// TODO: Make this configurable
	config := &fosite.Config{
		AccessTokenLifespan: time.Minute * 30,
		// GlobalSecret:        []byte("some-cool-secret-that-is-32bytes"),
		TokenURL:          fmt.Sprintf("%voauth2/token", cfg.AppURL),
		AccessTokenIssuer: cfg.AppURL,
		IDTokenIssuer:     cfg.AppURL,
		ScopeStrategy:     fosite.WildcardScopeStrategy,
		// ...
	}

	privateKey, errLoadKey := loadServerPrivateKey(skv)
	if errLoadKey != nil {
		// TODO log something
		return nil, errLoadKey
	}

	// storage := memstorage.NewGrafanaPluginAuthStore(config)

	s := &OAuth2ServiceImpl{
		cache:         localcache.New(cacheExpirationTime, cacheCleanupInterval),
		accessControl: accessControl,
		acService:     acSvc,
		memstore:      storage.NewMemoryStore(),
		sqlstore:      oauthstore.NewStore(db),
		logger:        log.New("oauthserver"),
		userService:   userSvc,
		saService:     svcAccSvc,
		teamService:   teamSvc,
		publicKey:     &privateKey.PublicKey,
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
			CoreStrategy:               compose.NewOAuth2JWTStrategy(keyGetter, compose.NewOAuth2HMACStrategy(config), config),
			OpenIDConnectTokenStrategy: compose.NewOpenIDConnectStrategy(keyGetter, config),
			Signer:                     &jwt.DefaultSigner{GetPrivateKey: keyGetter},
		},
		compose.OAuth2ClientCredentialsGrantFactory,
		compose.RFC7523AssertionGrantFactory,

		compose.OAuth2TokenIntrospectionFactory,
		compose.OAuth2TokenRevocationFactory,
	)
}

func loadServerPrivateKey(skv kvstore.SecretsKVStore) (*rsa.PrivateKey, error) {
	privatePem, ok, err := skv.Get(context.Background(), oauthserver.TmpOrgID, "OAuthServerPrivatePEM", "oauthserverpem")
	if err != nil {
		return nil, err
	}
	var privateKey *rsa.PrivateKey
	if !ok {
		var errGenKey error
		privateKey, errGenKey = rsa.GenerateKey(rand.Reader, 2048)
		if errGenKey != nil {
			return nil, errGenKey
		}
		privateKeyPem := string(pem.EncodeToMemory(&pem.Block{
			Type:  "RSA PRIVATE KEY",
			Bytes: x509.MarshalPKCS1PrivateKey(privateKey),
		}))
		if err = skv.Set(context.Background(), oauthserver.TmpOrgID, "OAuthServerPrivatePEM", "oauthserverpem", privateKeyPem); err != nil {
			return nil, err
		}
	} else {
		var errParseKey error
		privateKeyPem, _ := pem.Decode([]byte(privatePem))
		privateKey, errParseKey = x509.ParsePKCS1PrivateKey(privateKeyPem.Bytes)
		if errParseKey != nil {
			return nil, errParseKey
		}
	}
	return privateKey, nil
}

// GetServerPublicKey returns the public key of the server
func (s *OAuth2ServiceImpl) GetServerPublicKey() *rsa.PublicKey {
	return s.publicKey
}

func (s *OAuth2ServiceImpl) RandString(n int) (string, error) {
	res := make([]byte, n)
	_, err := rand.Read(res)
	if err != nil {
		return "", err
	}
	return base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(res), nil
}

// TODO it would be great to create the service account in the same DB session as the client
func (s *OAuth2ServiceImpl) RegisterExternalService(ctx context.Context,
	registration *oauthserver.ExternalServiceRegistration) (*oauthserver.ClientDTO, error) {
	if registration == nil {
		s.logger.Warn("RegisterExternalService called without registration")
		return nil, nil
	}

	client := oauthserver.Client{
		ExternalServiceName:    registration.ExternalServiceName,
		ImpersonatePermissions: registration.ImpersonatePermissions,
	}
	if registration.RedirectURI != nil {
		client.RedirectURI = *registration.RedirectURI
	}

	var errGenCred error
	client.ClientID, client.Secret, errGenCred = s.genCredentials()
	if errGenCred != nil {
		s.logger.Error("Error generating credentials", "client", client, "error", errGenCred)
		return nil, errGenCred
	}

	// Assign permissions to a service account that will be associated to the App
	id, err := s.createServiceAccount(ctx, registration.ExternalServiceName, registration.Permissions)
	if err != nil {
		return nil, err
	}
	client.ServiceAccountID = id

	client.GrantTypes = strings.Join(s.computeGrantTypes(registration.Permissions, registration.ImpersonatePermissions), ",")

	// Handle RSA key options
	s.logger.Debug("Handle key options")
	keys, err := s.handleKeyOptions(ctx, registration.Key)
	if err != nil {
		s.logger.Error("Error handling key options", "client", client, "error", err)
		return nil, err
	}
	if keys != nil {
		client.PublicPem = []byte(keys.PublicPem)
	}

	s.logger.Info("Registering app", "client", client)
	err = s.sqlstore.RegisterExternalService(ctx, &client)
	if err != nil {
		return nil, err
	}
	dto := client.ToDTO()
	dto.KeyResult = keys
	return dto, nil
}

func (s *OAuth2ServiceImpl) genCredentials() (string, string, error) {
	// TODO make the length configurable
	id, err := s.RandString(20)
	if err != nil {
		return "", "", err
	}
	// TODO make the length configurable
	secret, err := s.RandString(40)
	if err != nil {
		return "", "", err
	}
	return id, secret, err
}

func (s *OAuth2ServiceImpl) computeGrantTypes(selfPermissions []ac.Permission, impersonatePermissions []ac.Permission) []string {
	grantTypes := []string{}

	// If the app has permissions, it can use the client credentials grant type
	if len(selfPermissions) > 0 {
		grantTypes = append(grantTypes, string(fosite.GrantTypeClientCredentials))
	}

	// If the app has impersonate permissions, it can use the JWT bearer grant type
	// TODO should we also check if the app has users:impersonate permissions?
	if len(impersonatePermissions) > 0 {
		grantTypes = append(grantTypes, string(fosite.GrantTypeJWTBearer))
	}

	return grantTypes
}

// createServiceAccount creates a service account with the given permissions
// and returns the ID of the service account
// When no permission is given, the account isn't created and -1 is returned
// TODO we should use a single transaction for the whole service account creation process
func (s *OAuth2ServiceImpl) createServiceAccount(ctx context.Context, extSvcName string, permissions []ac.Permission) (int64, error) {
	if len(permissions) == 0 {
		return oauthserver.NoServiceAccountID, nil
	}

	newRole := func(r roletype.RoleType) *roletype.RoleType {
		return &r
	}
	newBool := func(b bool) *bool {
		return &b
	}

	slug := slugify.Slugify(extSvcName)

	// TODO: Can we use ServiceAccounts in global orgs in the future? As apps are available accross all orgs.
	// FIXME currently using orgID 1
	s.logger.Debug("Generate service account", "orgID", oauthserver.TmpOrgID, "name", slug)
	sa, err := s.saService.CreateServiceAccount(ctx, oauthserver.TmpOrgID, &serviceaccounts.CreateServiceAccountForm{
		Name:       slug,
		Role:       newRole(roletype.RoleViewer), // TODO: Use empty role
		IsDisabled: newBool(false),
	})
	if err != nil {
		return oauthserver.NoServiceAccountID, err
	}

	s.logger.Debug("Create tailored role for service account", "name", slug, "saID", sa.Id, "permissions", permissions)
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

func (s *OAuth2ServiceImpl) handleKeyOptions(ctx context.Context, keyOption *oauthserver.KeyOption) (*oauthserver.KeyResult, error) {
	if keyOption == nil {
		return nil, nil
	}

	if keyOption.Generate {
		RSAKey, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			return nil, err
		}
		return &oauthserver.KeyResult{
			PrivatePem: string(pem.EncodeToMemory(&pem.Block{
				Type:  "RSA PRIVATE KEY",
				Bytes: x509.MarshalPKCS1PrivateKey(RSAKey),
			})),
			PublicPem: string(pem.EncodeToMemory(&pem.Block{
				Type:  "RSA PUBLIC KEY",
				Bytes: x509.MarshalPKCS1PublicKey(&RSAKey.PublicKey),
			})),
			Generated: true,
		}, nil
	}

	// TODO allow specifying a URL to get the public key
	// if registration.Key.URL != "" {
	// 	return &oauthserver.KeyResult{
	// 		URL: registration.Key.URL,
	// 	}, nil
	// }

	if keyOption.PublicPEM != "" {
		return &oauthserver.KeyResult{
			PublicPem: keyOption.PublicPEM,
		}, nil
	}

	return nil, fmt.Errorf("at least one key option must be specified")
}

func (s *OAuth2ServiceImpl) GetExternalService(ctx context.Context, id string) (*oauthserver.Client, error) {
	entry, ok := s.cache.Get(id)
	if ok {
		app, ok := entry.(oauthserver.Client)
		if ok {
			return &app, nil
		}
	}

	app, err := s.sqlstore.GetExternalService(ctx, id)
	if err != nil {
		return nil, err
	}

	// TODO Handle case where the external service does not have a service account
	// Retrieve self permissions and generate a signed in user
	sa, err := s.saService.RetrieveServiceAccount(ctx, oauthserver.TmpOrgID, app.ServiceAccountID)
	if err != nil {
		return nil, err
	}

	app.SignedInUser = &user.SignedInUser{
		UserID:      sa.Id,
		OrgID:       oauthserver.TmpOrgID,
		OrgRole:     org.RoleType(sa.Role), // Need this to compute the permissions in OSS
		Login:       sa.Login,
		Name:        sa.Name,
		Permissions: map[int64]map[string][]string{},
	}
	app.SelfPermissions, err = s.acService.GetUserPermissions(ctx, app.SignedInUser, ac.Options{})
	if err != nil {
		return nil, err
	}
	app.SignedInUser.Permissions[oauthserver.TmpOrgID] = ac.GroupScopesByAction(app.SelfPermissions)

	// TODO: Retrieve org memberships
	app.OrgIDs = []int64{oauthserver.TmpOrgID}

	s.cache.Set(id, *app, cacheExpirationTime)

	return app, nil
}

func (s *OAuth2ServiceImpl) UpdateExternalService(ctx context.Context, cmd *oauthserver.UpdateClientCommand) (*oauthserver.ClientDTO, error) {
	if cmd == nil {
		s.logger.Warn("Update External Service called without a command")
		return nil, nil
	}

	previous, errFetchExtSvc := s.sqlstore.GetExternalServiceByName(ctx, cmd.ExternalServiceName)
	if errFetchExtSvc != nil {
		s.logger.Error("Error fetching service", "externale service", cmd.ExternalServiceName, "error", errFetchExtSvc)
		return nil, errFetchExtSvc
	}

	// TODO if we re-generate the clientID and clientSecret, we should invalidate all the tokens tied to it
	// TODO invalidate the client cache entry for the previous client ID
	if cmd.GenCredentials {
		id, secret, errGenCred := s.genCredentials()
		if errGenCred != nil {
			s.logger.Error("Error generating credentials", "externale service", cmd.ExternalServiceName, "error", errGenCred)
			return nil, errGenCred
		}
		cmd.ClientID, cmd.Secret = &id, &secret
	}
	if cmd.Permissions != nil {
		if previous.ServiceAccountID <= 0 {
			saID, errCreateSvcAcc := s.createServiceAccount(ctx, cmd.ExternalServiceName, cmd.Permissions)
			if errCreateSvcAcc != nil {
				s.logger.Error("Error creating service account", "externale service", cmd.ExternalServiceName, "error", errCreateSvcAcc)
				return nil, errCreateSvcAcc
			}
			cmd.ServiceAccountID = &saID
		} else {
			// check if the service account exists
			sa, errFetchSvcAcc := s.saService.RetrieveServiceAccount(ctx, oauthserver.TmpOrgID, previous.ServiceAccountID)
			if errFetchSvcAcc != nil {
				s.logger.Error("Error retrieving service account", "externale service", cmd.ExternalServiceName, "error", errFetchSvcAcc)
				return nil, errFetchSvcAcc
			}
			if len(cmd.Permissions) > 0 {
				// update the service account's permissions
				if err := s.acService.SaveExternalServiceRole(ctx, ac.SaveExternalServiceRoleCommand{
					OrgID:             ac.GlobalOrgID,
					Global:            true,
					ExternalServiceID: cmd.ExternalServiceName,
					ServiceAccountID:  sa.Id,
					Permissions:       cmd.Permissions,
				}); err != nil {
					return nil, err
				}
			} else {
				// remove the service account
				if err := s.saService.DeleteServiceAccount(ctx, oauthserver.TmpOrgID, sa.Id); err != nil {
					return nil, err
				}
				cmd.ServiceAccountID = func() *int64 { var i int64 = oauthserver.NoServiceAccountID; return &i }()
			}
		}
	}
	if cmd.Key != nil {
		keyResult, errKeyHandling := s.handleKeyOptions(ctx, cmd.Key)
		if errKeyHandling != nil {
			s.logger.Error("Error handling key options", "externale service", cmd.ExternalServiceName, "error", errKeyHandling)
			return nil, errKeyHandling
		}
		if keyResult != nil {
			cmd.PublicPem = []byte(keyResult.PublicPem)
		}
	}
	// If we have an update in permissions => recompute grant types
	if cmd.Permissions != nil || cmd.ImpersonatePermissions != nil {
		permissions := cmd.Permissions
		if permissions == nil {
			permissions = previous.SelfPermissions
		}
		impersonatePermissions := cmd.ImpersonatePermissions
		if impersonatePermissions == nil {
			impersonatePermissions = previous.ImpersonatePermissions
		}
		grantTypes := strings.Join(s.computeGrantTypes(permissions, impersonatePermissions), ",")
		cmd.GrantTypes = &grantTypes
	}

	client, errUpdate := s.sqlstore.UpdateExternalService(ctx, cmd)
	if errUpdate != nil {
		s.logger.Error("Error updating service", "externale service", cmd.ExternalServiceName, "error", errUpdate)
		return nil, errUpdate
	}
	return client.ToDTO(), nil
}

// TODO cache scopes
// ComputeClientScopesOnTarget computes the scopes that a client has on a specific user (targetLogin) only searching in the subset of scopes provided
func (s *OAuth2ServiceImpl) computeClientScopesOnUser(ctx context.Context, client *oauthserver.Client, userID int64) (fosite.Arguments, error) {
	// TODO I used userID here as we used it for the ext jwt service, but it would be better to use login as app shouldn't know the user id
	// TODO Inefficient again as we fetch the user to populate the id_token again later
	// Check user existence
	_, err := s.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: userID})
	if err != nil {
		return nil, err
	}

	// Compute the scopes on the target user
	scopes := client.GetOpenIDScope()
	scopes = append(scopes, client.GetOrgScopes()...)
	scopes = append(scopes, client.GetScopesOnUser(ctx, s.accessControl, userID)...)

	return scopes, nil
}
