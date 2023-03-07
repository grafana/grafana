package api

import (
	"context"
	"crypto/x509"
	"encoding/pem"
	"net/http"

	"github.com/ory/fosite"
	"github.com/ory/fosite/compose"

	"github.com/ory/fosite/token/jwt"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/oauthserver"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

type api struct {
	router        routing.RouteRegister
	oauthService  oauthserver.OAuth2Service
	oauthProvider fosite.OAuth2Provider
	userService   user.Service
	saService     serviceaccounts.Service
	acService     ac.Service
	teamService   team.Service
	tmpUser       user.SignedInUser
}

func NewAPI(
	router routing.RouteRegister,
	oauthService oauthserver.OAuth2Service,
	config *fosite.Config,
	storage interface{},
	userService user.Service,
	teamService team.Service,
	acService ac.Service,
	saService serviceaccounts.Service,
) *api {
	// TODO: Make this configurable
	privateKeyRaw, _ := pem.Decode([]byte(`-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAvDNW/jqNoL6cJ7m1T/qMfNxouV9kItOWlA8NKm9vDickN8Dz
+jMqog9/BJH5k2S5+AzB9aTo52Sm6XqiBvK3lrHA3aH2z9Zn0UVpccKxlsRfqaE1
HYRFhRB80+gzZpeSHQmSYPLqOzhSB+Ytqz1ZmkW/DqjTwKrBSjP+RrFUZoDGU+/1
FD92s0lMZbAlT+SDvawC5zuxWk7N9BuCZQ35FYKs7YM8wQv/mcq3kmeH47CGF7OQ
yH1sPfA+2GN4s+8UtK24rPd+ecS0pOD/pP5mW9J8Hl7JHR1e/5apPTEKovsKkgj4
IMr8+2CXMkMTS1s1yY0enWdkzv4kiiHnJIHnXwIDAQABAoIBAQCN4K5OTdoDOm8C
S6/yMVHDt22DgfQ9hQFZcNdeDE/OfZeCKIZFMlmLft8klN9vTFoeM4/tHXsvJePm
07pePpBEnJBnBPjJyjrNuuQ5DKtQm436lTszm0nFfJ5+KejGCLHwDg055SbLqjO9
HLuFAmUQNlBIPuITtyasR/IDXR/hfRoD0Ozrq2BeHyn0wzD4fKPvbn8g7Z42oGQC
PuxRuLnWrPNkN2fJ25y8KErVDhQx5UevLNLsb9peMogXxdgEwucsDcVAAYQ7zmzj
9NMR0VVuOUX12jAL32xFQEVg/+FxgIVNyUKoOVqNySdY7vSPSAAzRwZ8j9fPwgPL
S3PjGZbBAoGBAPVpGvyE/KEUBYZ1Xqfam+fk3oJGz/RIGc4nSYLm2u7hu+oLuz38
1PJ1gVbZLmeMCmwKeHnWFJEf9ZHnFVsnBgEKfHbsI1SRQDQ6R38uezGMg5Cw5lbd
rjBzuAOq3E0YC+7gj5Q5FTKp4xOX0BAk0YfZSyNelGTQtLJbgb7vyUsxAoGBAMRS
RYqn3I+J+zh7jRmfHxzYt7S28kbmNmUbSPQJ05kM7m5QGlHZ8xjqWfwZ4AyEk14P
/BokgDh3wAzHcufTLY5+bJGM5S2/AojBuUpf4Jzo2YZ8LMvLjoTmEURuen2tk/3T
PqEM11JBeG4mtmKyfR89/tcMl634qR7ga0nnZ5ePAoGACn4N61H8Qx7KBa+q9l5A
YC/G26cPaRBUGh5P5ErefWwlTqJlxQa0TBF+ECqE82RnZask74CZrILDSxOoNBd9
CDpci/EYqZr0NcdwGx3vonSxg1Qs5PXhZqzr5yw88wbeK75qJRozr9DXppTNDoOk
ebxum/qFObI6p42GBJXX82ECgYA8V81oQRBaTl8ZjWBhb7dwdmyA73qosDon+asC
18JiWMcwwQ5V+lfuYJooEwv6zQU+9ErY/j8rHCO7ydJXz2FBWzqjwlrvJLbyshjx
82Zm1GuIGsLqITc9QjosfojH+IJ0kmm9tuS4M8eAlAWbcKFk6PlbwFMe9j+FbhWM
McR1oQKBgQDuVHu7gmjob4f2ROgbCKaGoACxqySYqmmNN6YQzTODfonLKNAOmEwM
JDqH99cJ2R0Hj3V2qEVenwmZPweX11nevLXRRxZxYz18yJYjstfFOOxWlITpzS8N
UxjxdY0kfwwb6Koac+agbAzO8RlgN+YNCuGTrRkTes8ILeAMl9Vngw==
-----END RSA PRIVATE KEY-----`))

	var privateKey, _ = x509.ParsePKCS1PrivateKey(privateKeyRaw.Bytes)

	return &api{
		router:        router,
		oauthService:  oauthService,
		oauthProvider: NewProvider(config, storage, privateKey),
		userService:   userService,
		saService:     saService,
		teamService:   teamService,
		acService:     acService,
		tmpUser: user.SignedInUser{
			UserID:      -1,
			OrgID:       1,
			Permissions: map[int64]map[string][]string{1: {"users.permissions:read": {"users:*"}, "teams:read": {"teams:*"}}},
		},
	}
}

// privateKey is used to sign JWT tokens. The default strategy uses RS256 (RSA Signature with SHA-256)

func NewProvider(config *fosite.Config, storage interface{}, key interface{}) fosite.OAuth2Provider {
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

func (a *api) RegisterAPIEndpoints() {
	// authorize := ac.Middleware(a.ac)
	a.router.Group("/oauth2", func(oauthRouter routing.RouteRegister) {
		// oauthRouter.Get("/client/:id", middleware.ReqGrafanaAdmin, a.getClient)
		oauthRouter.Post("/register", a.register) // Register'd be done by plugin install actually
		// oauthRouter.Post("/unregister", a.unregister) // Unregister'd be done by plugin uninstall actually
		oauthRouter.Post("/introspect", a.introspectionEndpoint)
		oauthRouter.Post("/token", a.tokenEndpoint)
	}) // TODO: add oauth feature check
}

func (a *api) register(c *contextmodel.ReqContext) response.Response {
	registration := &oauthserver.AppRegistration{}
	err := web.Bind(c.Req, registration)
	if err != nil {
		return response.Error(http.StatusBadRequest, "invalid registration", err)
	}

	app, err := a.oauthService.RegisterApp(c.Req.Context(), registration)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "could not register app", err)
	}
	return response.JSON(http.StatusOK, app)
}
