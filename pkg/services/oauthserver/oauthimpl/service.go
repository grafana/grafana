package oauthimpl

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"time"

	"github.com/ory/fosite"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models/roletype"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/oauthserver"
	"github.com/grafana/grafana/pkg/services/oauthserver/api"
	"github.com/grafana/grafana/pkg/services/oauthserver/authstorage"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
)

type OAuth2ServiceImpl struct {
	svcAccSvc serviceaccounts.Service
	acSvc     ac.Service
	// db        *database.Store
	store  *authstorage.GrafanaPluginAuthStore
	logger log.Logger
}

func ProvideService(router routing.RouteRegister, svcAccSvc serviceaccounts.Service,
	acSvc ac.Service, userSvc user.Service, teamSvc team.Service) *OAuth2ServiceImpl {

	config := &fosite.Config{
		AccessTokenLifespan: time.Minute * 2,
		GlobalSecret:        []byte("some-cool-secret-that-is-32bytes"),
		TokenURL:            "http://localhost:3000/oauth2/token",
		AccessTokenIssuer:   "http://localhost:3000",
		IDTokenIssuer:       "http://localhost:3000",
		ScopeStrategy:       fosite.WildcardScopeStrategy,
		// ...
	}
	s := &OAuth2ServiceImpl{
		svcAccSvc: svcAccSvc,
		acSvc:     acSvc,
		// db:        database.NewStore(db),
		store:  authstorage.NewGrafanaPluginAuthStore(config),
		logger: log.New("oauthserver"),
	}

	api := api.NewAPI(router, s, config, s.store, userSvc, teamSvc, acSvc, svcAccSvc)
	api.RegisterAPIEndpoints()

	return s
}

func (s *OAuth2ServiceImpl) RandString(n int) (string, error) {
	res := make([]byte, n)
	_, err := rand.Read(res)
	if err != nil {
		return "", err
	}
	return base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(res), nil
}

func (s *OAuth2ServiceImpl) RegisterApp(ctx context.Context, registration *oauthserver.AppRegistration) (*oauthserver.Client, error) {
	res := oauthserver.Client{
		AppName: registration.AppName,
	}
	if registration.RedirectURI != nil {
		res.RedirectURI = *registration.RedirectURI
	}

	res.Domain = "http://localhost" // TODO: Make this configurable

	id, err := s.RandString(20)
	if err != nil {
		s.logger.Error("Error gen id", "client", res, "error", err)
		return nil, err
	}
	res.ID = id
	secret, err := s.RandString(40)
	if err != nil {
		s.logger.Error("Error gen secret", "client", res, "error", err)
		return nil, err
	}
	res.Secret = secret

	// Assign permissions to a service account that will be associated to the App
	if len(registration.Permissions) > 0 {
		s.logger.Debug("Generate service account")
		id, err := s.createServiceAccount(ctx, registration)
		if err != nil {
			return nil, err
		}
		res.ServiceAccountID = id
	}

	// Handle RSA key options
	s.logger.Debug("Handle key options")
	res.Key, err = s.handleKeyOptions(ctx, registration)
	if err != nil {
		s.logger.Error("Error handling key options", "client", res, "error", err)
		return nil, err
	}

	s.logger.Info("Registering app", "client", res)
	err = s.store.RegisterClient(ctx, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

func (s *OAuth2ServiceImpl) createServiceAccount(ctx context.Context, registration *oauthserver.AppRegistration) (int64, error) {
	newRole := func(r roletype.RoleType) *roletype.RoleType {
		return &r
	}
	newBool := func(b bool) *bool {
		return &b
	}

	// TODO: Can we use ServiceAccounts in global orgs in the future? As apps are available accross all orgs.
	// FIXME currently using orgID 1
	sa, err := s.svcAccSvc.CreateServiceAccount(ctx, 1, &serviceaccounts.CreateServiceAccountForm{
		Name:       registration.AppName,
		Role:       newRole(roletype.RoleViewer), // TODO: Use empty role
		IsDisabled: newBool(false),
	})
	if err != nil {
		return -1, err
	}

	// TODO: Use managed permissions since in OSS we don't have access to regular assignments
	// role, err := s.acSvc.CreateRole(ctx, ac.GlobalOrgID, ac.CreateRoleCommand{
	// 	UID:         fmt.Sprintf("app_servicesaccounts_%v_permissions", sa.Id), // FIXME use managed instead of app
	// 	Name:        fmt.Sprintf("app:servicesaccounts:%v:permissions", sa.Id), // FIXME use managed instead of app
	// 	Permissions: registration.Permissions,
	// 	Description: fmt.Sprintf("Managed role for service account %v created for %s", sa.Id, registration.AppName),
	// 	Version:     1,
	// 	Hidden:      true,
	// })
	// if err != nil {
	// 	return -1, err
	// }

	// if err = s.acSvc.AddUserRole(ctx, ac.GlobalOrgID, ac.AddUserRoleCommand{
	// 	Global:  true,
	// 	RoleUID: role.UID,
	// 	UserID:  sa.Id,
	// }); err != nil {
	// 	return -1, err
	// }

	return sa.Id, nil
}

func (s *OAuth2ServiceImpl) handleKeyOptions(ctx context.Context, registration *oauthserver.AppRegistration) (*oauthserver.KeyResult, error) {
	if registration.Key == nil {
		return nil, nil
	}

	if registration.Key.Generate {
		RSAKey, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			return nil, err
		}
		return &oauthserver.KeyResult{
			Key: RSAKey,
			Private: string(pem.EncodeToMemory(&pem.Block{
				Type:  "RSA PRIVATE KEY",
				Bytes: x509.MarshalPKCS1PrivateKey(RSAKey),
			})),
			Public: string(pem.EncodeToMemory(&pem.Block{
				Type:  "RSA PUBLIC KEY",
				Bytes: x509.MarshalPKCS1PublicKey(&RSAKey.PublicKey),
			})),
			Generated: true,
		}, nil
	}

	if registration.Key.URL != "" {
		return &oauthserver.KeyResult{
			URL: registration.Key.URL,
		}, nil
	}

	if registration.Key.Value != "" {
		return &oauthserver.KeyResult{
			Public: registration.Key.Value,
		}, nil
	}

	return nil, fmt.Errorf("at least one key option must be specified")
}

func (s *OAuth2ServiceImpl) GetClient(ctx context.Context, id string) (*oauthserver.Client, error) {
	return s.store.GetApp(ctx, id)
}
