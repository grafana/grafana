package server

import (
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/oauthtoken/oauthtokentest"
	grafanasecrets "github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/mock"
)

func ProvideTestEnv(
	testingT interface {
		mock.TestingT
		Cleanup(func())
	},
	server *Server,
	db db.DB,
	cfg *setting.Cfg,
	ns *notifications.NotificationServiceMock,
	grpcServer grpcserver.Provider,
	pluginRegistry registry.Service,
	httpClientProvider httpclient.Provider,
	oAuthTokenService *oauthtokentest.Service,
	featureMgmt featuremgmt.FeatureToggles,
	resourceClient resource.ResourceClient,
	idService auth.IDService,
	githubFactory *github.Factory,
	legacySecretsSvc grafanasecrets.Service,
	secretsSvc *service.SecureValueService,
	decryptSvc service.DecryptService,
) (*TestEnv, error) {
	// TODO: Add a provide function for wire
	secretsService := secrets.NewRepositorySecrets(featureMgmt, secrets.NewSecretsService(secretsSvc, decryptSvc), secrets.NewSingleTenant(legacySecretsSvc))
	return &TestEnv{
		TestingT:            testingT,
		Server:              server,
		SQLStore:            db,
		Cfg:                 cfg,
		NotificationService: ns,
		GRPCServer:          grpcServer,
		PluginRegistry:      pluginRegistry,
		HTTPClientProvider:  httpClientProvider,
		OAuthTokenService:   oAuthTokenService,
		FeatureToggles:      featureMgmt,
		ResourceClient:      resourceClient,
		IDService:           idService,
		GitHubFactory:       githubFactory,
		SecretsService:      secretsService,
	}, nil
}

type TestEnv struct {
	TestingT interface {
		mock.TestingT
		Cleanup(func())
	}
	Server              *Server
	SQLStore            db.DB
	Cfg                 *setting.Cfg
	NotificationService *notifications.NotificationServiceMock
	GRPCServer          grpcserver.Provider
	PluginRegistry      registry.Service
	HTTPClientProvider  httpclient.Provider
	OAuthTokenService   *oauthtokentest.Service
	RequestMiddleware   web.Middleware
	FeatureToggles      featuremgmt.FeatureToggles
	ResourceClient      resource.ResourceClient
	IDService           auth.IDService
	GitHubFactory       *github.Factory
	SecretsService      secrets.RepositorySecrets
}
