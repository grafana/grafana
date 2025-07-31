package api

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"net"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/youmark/pkcs8"

	"github.com/grafana/grafana/pkg/api/avatar"
	"github.com/grafana/grafana/pkg/api/routing"
	httpstatic "github.com/grafana/grafana/pkg/api/static"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/middleware/csrf"
	"github.com/grafana/grafana/pkg/middleware/loggermw"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/anonymous"
	"github.com/grafana/grafana/pkg/services/apikey"
	grafanaapiserver "github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/cleanup"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/correlations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/datasourceproxy"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/datasources/guardian"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/librarypanels"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/live"
	"github.com/grafana/grafana/pkg/services/live/pushhttp"
	"github.com/grafana/grafana/pkg/services/login"
	loginAttempt "github.com/grafana/grafana/pkg/services/loginattempt"
	"github.com/grafana/grafana/pkg/services/navtree"
	"github.com/grafana/grafana/pkg/services/ngalert"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/playlist"
	"github.com/grafana/grafana/pkg/services/plugindashboards"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/managedplugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginassets"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginchecker"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	pluginSettings "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/provisioning"
	publicdashboardsApi "github.com/grafana/grafana/pkg/services/publicdashboards/api"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/queryhistory"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/searchV2"
	"github.com/grafana/grafana/pkg/services/searchusers"
	"github.com/grafana/grafana/pkg/services/secrets"
	secretsKV "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	spm "github.com/grafana/grafana/pkg/services/secrets/kvstore/migrations"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/grafana/grafana/pkg/services/star"
	starApi "github.com/grafana/grafana/pkg/services/star/api"
	"github.com/grafana/grafana/pkg/services/stats"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/tag"
	"github.com/grafana/grafana/pkg/services/team"
	tempUser "github.com/grafana/grafana/pkg/services/temp_user"
	"github.com/grafana/grafana/pkg/services/updatemanager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

type HTTPServer struct {
	log              log.Logger
	web              *web.Mux
	context          context.Context
	httpSrv          *http.Server
	middlewares      []web.Handler
	namedMiddlewares []routing.RegisterNamedMiddleware
	bus              bus.Bus

	pluginContextProvider        *plugincontext.Provider
	RouteRegister                routing.RouteRegister
	RenderService                rendering.Service
	Cfg                          setting.SettingsProvider
	Features                     featuremgmt.FeatureToggles
	SettingsProvider             setting.Provider
	HooksService                 *hooks.HooksService
	navTreeService               navtree.Service
	CacheService                 *localcache.CacheService
	DataSourceCache              datasources.CacheService
	AuthTokenService             auth.UserTokenService
	QuotaService                 quota.Service
	RemoteCacheService           *remotecache.RemoteCache
	ProvisioningService          provisioning.ProvisioningService
	License                      licensing.Licensing
	AccessControl                accesscontrol.AccessControl
	DataProxy                    *datasourceproxy.DataSourceProxyService
	DataSourceRequestValidator   validations.DataSourceRequestValidator
	pluginClient                 plugins.Client
	pluginStore                  pluginstore.Store
	pluginInstaller              plugins.Installer
	pluginFileStore              plugins.FileStore
	pluginDashboardService       plugindashboards.Service
	pluginStaticRouteResolver    plugins.StaticRouteResolver
	pluginErrorResolver          plugins.ErrorResolver
	pluginAssets                 *pluginassets.Service
	pluginPreinstall             pluginchecker.Preinstall
	SearchService                search.Service
	ShortURLService              shorturls.Service
	QueryHistoryService          queryhistory.Service
	CorrelationsService          correlations.Service
	Live                         *live.GrafanaLive
	LivePushGateway              *pushhttp.Gateway
	StorageService               store.StorageService
	SearchV2HTTPService          searchV2.SearchHTTPService
	ContextHandler               *contexthandler.ContextHandler
	LoggerMiddleware             loggermw.Logger
	SQLStore                     db.DB
	AlertNG                      *ngalert.AlertNG
	LibraryPanelService          librarypanels.Service
	LibraryElementService        libraryelements.Service
	SocialService                social.Service
	Listener                     net.Listener
	EncryptionService            encryption.Internal
	SecretsService               secrets.Service
	secretsStore                 secretsKV.SecretsKVStore
	SecretsMigrator              secrets.Migrator
	secretMigrationProvider      spm.SecretMigrationProvider
	DataSourcesService           datasources.DataSourceService
	cleanUpService               *cleanup.CleanUpService
	tracer                       tracing.Tracer
	grafanaUpdateChecker         *updatemanager.GrafanaService
	pluginsUpdateChecker         *updatemanager.PluginsService
	searchUsersService           searchusers.Service
	queryDataService             query.Service
	serviceAccountsService       serviceaccounts.Service
	authInfoService              login.AuthInfoService
	NotificationService          notifications.Service
	DashboardService             dashboards.DashboardService
	dashboardProvisioningService dashboards.DashboardProvisioningService
	folderService                folder.Service
	dsGuardian                   guardian.DatasourceGuardianProvider
	dashboardsnapshotsService    dashboardsnapshots.Service
	PluginSettings               pluginSettings.Service
	AvatarCacheServer            *avatar.AvatarCacheServer
	preferenceService            pref.Service
	Csrf                         csrf.Service
	folderPermissionsService     accesscontrol.FolderPermissionsService
	dashboardPermissionsService  accesscontrol.DashboardPermissionsService
	dashboardVersionService      dashver.Service
	PublicDashboardsApi          *publicdashboardsApi.Api
	starService                  star.Service
	playlistService              playlist.Service
	apiKeyService                apikey.Service
	kvStore                      kvstore.KVStore
	pluginsCDNService            *pluginscdn.Service
	managedPluginsService        managedplugins.Manager

	userService          user.Service
	tempUserService      tempUser.Service
	loginAttemptService  loginAttempt.Service
	orgService           org.Service
	orgDeletionService   org.DeletionService
	TeamService          team.Service
	accesscontrolService accesscontrol.Service
	annotationsRepo      annotations.Repository
	tagService           tag.Service
	oauthTokenService    oauthtoken.OAuthTokenService
	statsService         stats.Service
	authnService         authn.Service
	starApi              *starApi.API
	promRegister         prometheus.Registerer
	promGatherer         prometheus.Gatherer
	clientConfigProvider grafanaapiserver.DirectRestConfigProvider
	namespacer           request.NamespaceMapper
	anonService          anonymous.Service
	userVerifier         user.Verifier
	tlsCerts             TLSCerts
}

type TLSCerts struct {
	certLock  sync.RWMutex
	certMtime time.Time
	keyMtime  time.Time
	certs     *tls.Certificate
}

type ServerOptions struct {
	Listener net.Listener
}

func ProvideHTTPServer(opts ServerOptions, config setting.SettingsProvider, routeRegister routing.RouteRegister, bus bus.Bus,
	renderService rendering.Service, licensing licensing.Licensing, hooksService *hooks.HooksService,
	cacheService *localcache.CacheService, sqlStore db.DB,
	dataSourceRequestValidator validations.DataSourceRequestValidator, pluginStaticRouteResolver plugins.StaticRouteResolver,
	pluginDashboardService plugindashboards.Service, pluginStore pluginstore.Store, pluginClient plugins.Client,
	pluginErrorResolver plugins.ErrorResolver, pluginInstaller plugins.Installer, settingsProvider setting.Provider,
	dataSourceCache datasources.CacheService, userTokenService auth.UserTokenService,
	cleanUpService *cleanup.CleanUpService, shortURLService shorturls.Service, queryHistoryService queryhistory.Service,
	correlationsService correlations.Service, remoteCache *remotecache.RemoteCache, provisioningService provisioning.ProvisioningService,
	accessControl accesscontrol.AccessControl, dataSourceProxy *datasourceproxy.DataSourceProxyService, searchService *search.SearchService,
	live *live.GrafanaLive, livePushGateway *pushhttp.Gateway, plugCtxProvider *plugincontext.Provider,
	contextHandler *contexthandler.ContextHandler, loggerMiddleware loggermw.Logger, features featuremgmt.FeatureToggles,
	alertNG *ngalert.AlertNG, libraryPanelService librarypanels.Service, libraryElementService libraryelements.Service,
	quotaService quota.Service, socialService social.Service, tracer tracing.Tracer,
	encryptionService encryption.Internal, grafanaUpdateChecker *updatemanager.GrafanaService,
	pluginsUpdateChecker *updatemanager.PluginsService, searchUsersService searchusers.Service,
	dataSourcesService datasources.DataSourceService, queryDataService query.Service, pluginFileStore plugins.FileStore,
	serviceaccountsService serviceaccounts.Service, pluginAssets *pluginassets.Service,
	authInfoService login.AuthInfoService, storageService store.StorageService,
	notificationService notifications.Service, dashboardService dashboards.DashboardService,
	dashboardProvisioningService dashboards.DashboardProvisioningService, folderService folder.Service,
	dsGuardian guardian.DatasourceGuardianProvider,
	dashboardsnapshotsService dashboardsnapshots.Service, pluginSettings pluginSettings.Service,
	avatarCacheServer *avatar.AvatarCacheServer, preferenceService pref.Service,
	folderPermissionsService accesscontrol.FolderPermissionsService,
	dashboardPermissionsService accesscontrol.DashboardPermissionsService, dashboardVersionService dashver.Service,
	starService star.Service, csrfService csrf.Service, managedPlugins managedplugins.Manager,
	playlistService playlist.Service, apiKeyService apikey.Service, kvStore kvstore.KVStore,
	secretsMigrator secrets.Migrator, secretsService secrets.Service,
	secretMigrationProvider spm.SecretMigrationProvider, secretsStore secretsKV.SecretsKVStore,
	publicDashboardsApi *publicdashboardsApi.Api, userService user.Service, tempUserService tempUser.Service,
	loginAttemptService loginAttempt.Service, orgService org.Service, orgDeletionService org.DeletionService, teamService team.Service,
	accesscontrolService accesscontrol.Service, navTreeService navtree.Service,
	annotationRepo annotations.Repository, tagService tag.Service, searchv2HTTPService searchV2.SearchHTTPService, oauthTokenService oauthtoken.OAuthTokenService,
	statsService stats.Service, authnService authn.Service, pluginsCDNService *pluginscdn.Service, promGatherer prometheus.Gatherer,
	starApi *starApi.API, promRegister prometheus.Registerer, clientConfigProvider grafanaapiserver.DirectRestConfigProvider, anonService anonymous.Service,
	userVerifier user.Verifier, pluginPreinstall pluginchecker.Preinstall,
) (*HTTPServer, error) {
	cfg := config.Get()
	web.Env = cfg.Env
	m := web.New()

	hs := &HTTPServer{
		Cfg:                          config,
		RouteRegister:                routeRegister,
		bus:                          bus,
		RenderService:                renderService,
		License:                      licensing,
		HooksService:                 hooksService,
		CacheService:                 cacheService,
		SQLStore:                     sqlStore,
		DataSourceRequestValidator:   dataSourceRequestValidator,
		pluginInstaller:              pluginInstaller,
		pluginClient:                 pluginClient,
		pluginStore:                  pluginStore,
		pluginStaticRouteResolver:    pluginStaticRouteResolver,
		pluginDashboardService:       pluginDashboardService,
		pluginAssets:                 pluginAssets,
		pluginErrorResolver:          pluginErrorResolver,
		pluginFileStore:              pluginFileStore,
		grafanaUpdateChecker:         grafanaUpdateChecker,
		pluginsUpdateChecker:         pluginsUpdateChecker,
		pluginPreinstall:             pluginPreinstall,
		SettingsProvider:             settingsProvider,
		DataSourceCache:              dataSourceCache,
		AuthTokenService:             userTokenService,
		cleanUpService:               cleanUpService,
		ShortURLService:              shortURLService,
		QueryHistoryService:          queryHistoryService,
		CorrelationsService:          correlationsService,
		Features:                     features, // a read only view of the managers state
		StorageService:               storageService,
		RemoteCacheService:           remoteCache,
		ProvisioningService:          provisioningService,
		AccessControl:                accessControl,
		DataProxy:                    dataSourceProxy,
		SearchV2HTTPService:          searchv2HTTPService,
		SearchService:                searchService,
		Live:                         live,
		LivePushGateway:              livePushGateway,
		pluginContextProvider:        plugCtxProvider,
		ContextHandler:               contextHandler,
		LoggerMiddleware:             loggerMiddleware,
		AlertNG:                      alertNG,
		LibraryPanelService:          libraryPanelService,
		LibraryElementService:        libraryElementService,
		QuotaService:                 quotaService,
		tracer:                       tracer,
		log:                          log.New("http.server"),
		web:                          m,
		Listener:                     opts.Listener,
		SocialService:                socialService,
		EncryptionService:            encryptionService,
		SecretsService:               secretsService,
		SecretsMigrator:              secretsMigrator,
		secretMigrationProvider:      secretMigrationProvider,
		secretsStore:                 secretsStore,
		DataSourcesService:           dataSourcesService,
		searchUsersService:           searchUsersService,
		queryDataService:             queryDataService,
		serviceAccountsService:       serviceaccountsService,
		authInfoService:              authInfoService,
		NotificationService:          notificationService,
		DashboardService:             dashboardService,
		dashboardProvisioningService: dashboardProvisioningService,
		folderService:                folderService,
		dsGuardian:                   dsGuardian,
		dashboardsnapshotsService:    dashboardsnapshotsService,
		PluginSettings:               pluginSettings,
		AvatarCacheServer:            avatarCacheServer,
		preferenceService:            preferenceService,
		Csrf:                         csrfService,
		folderPermissionsService:     folderPermissionsService,
		dashboardPermissionsService:  dashboardPermissionsService,
		dashboardVersionService:      dashboardVersionService,
		starService:                  starService,
		playlistService:              playlistService,
		apiKeyService:                apiKeyService,
		kvStore:                      kvStore,
		PublicDashboardsApi:          publicDashboardsApi,
		userService:                  userService,
		tempUserService:              tempUserService,
		loginAttemptService:          loginAttemptService,
		orgService:                   orgService,
		orgDeletionService:           orgDeletionService,
		TeamService:                  teamService,
		navTreeService:               navTreeService,
		accesscontrolService:         accesscontrolService,
		annotationsRepo:              annotationRepo,
		tagService:                   tagService,
		oauthTokenService:            oauthTokenService,
		statsService:                 statsService,
		authnService:                 authnService,
		pluginsCDNService:            pluginsCDNService,
		managedPluginsService:        managedPlugins,
		starApi:                      starApi,
		promRegister:                 promRegister,
		promGatherer:                 promGatherer,
		clientConfigProvider:         clientConfigProvider,
		namespacer:                   request.GetNamespaceMapper(config),
		anonService:                  anonService,
		userVerifier:                 userVerifier,
	}
	if hs.Listener != nil {
		hs.log.Debug("Using provided listener")
	}
	hs.registerRoutes()

	// Register access control scope resolver for annotations
	hs.AccessControl.RegisterScopeAttributeResolver(AnnotationTypeScopeResolver(hs.annotationsRepo, features, dashboardService, folderService))

	if err := hs.declareFixedRoles(); err != nil {
		return nil, err
	}
	return hs, nil
}

func (hs *HTTPServer) AddMiddleware(middleware web.Handler) {
	hs.middlewares = append(hs.middlewares, middleware)
}

func (hs *HTTPServer) AddNamedMiddleware(middleware routing.RegisterNamedMiddleware) {
	hs.namedMiddlewares = append(hs.namedMiddlewares, middleware)
}

func (hs *HTTPServer) Run(ctx context.Context) error {
	cfg := hs.Cfg.Get()
	hs.context = ctx

	hs.applyRoutes()

	// Remove any square brackets enclosing IPv6 addresses, a format we support for backwards compatibility
	host := strings.TrimSuffix(strings.TrimPrefix(cfg.HTTPAddr, "["), "]")
	hs.httpSrv = &http.Server{
		Addr:        net.JoinHostPort(host, cfg.HTTPPort),
		Handler:     hs.web,
		ReadTimeout: cfg.ReadTimeout,
	}
	switch cfg.Protocol {
	case setting.HTTP2Scheme, setting.HTTPSScheme:
		if err := hs.configureTLS(); err != nil {
			return err
		}
		if cfg.CertFile != "" && cfg.KeyFile != "" {
			if cfg.CertWatchInterval > 0 {
				hs.httpSrv.TLSConfig.GetCertificate = hs.GetCertificate
				go hs.WatchAndUpdateCerts(ctx)
				hs.log.Debug("HTTP Server certificates reload feature is enabled")
			} else {
				hs.log.Debug("HTTP Server certificates reload feature is NOT enabled")
			}
		}
	default:
	}

	listener, err := hs.getListener()
	if err != nil {
		return err
	}

	hs.log.Info("HTTP Server Listen", "address", listener.Addr().String(), "protocol",
		cfg.Protocol, "subUrl", cfg.AppSubURL, "socket", cfg.SocketPath)

	var wg sync.WaitGroup
	wg.Add(1)

	// handle http shutdown on server context done
	go func() {
		defer wg.Done()

		<-ctx.Done()
		if err := hs.httpSrv.Shutdown(context.Background()); err != nil {
			hs.log.Error("Failed to shutdown server", "error", err)
		}
	}()

	switch cfg.Protocol {
	case setting.HTTPScheme, setting.SocketScheme:
		if err := hs.httpSrv.Serve(listener); err != nil {
			if errors.Is(err, http.ErrServerClosed) {
				hs.log.Debug("server was shutdown gracefully")
				return nil
			}
			return err
		}
	case setting.HTTP2Scheme, setting.HTTPSScheme:
		if err := hs.httpSrv.ServeTLS(listener, "", ""); err != nil {
			if errors.Is(err, http.ErrServerClosed) {
				hs.log.Debug("server was shutdown gracefully")
				return nil
			}
			return err
		}
	default:
		panic(fmt.Sprintf("Unhandled protocol %q", cfg.Protocol))
	}

	wg.Wait()

	return nil
}

func (hs *HTTPServer) getListener() (net.Listener, error) {
	cfg := hs.Cfg.Get()
	if hs.Listener != nil {
		return hs.Listener, nil
	}

	switch cfg.Protocol {
	case setting.HTTPScheme, setting.HTTPSScheme, setting.HTTP2Scheme:
		listener, err := net.Listen("tcp", hs.httpSrv.Addr)
		if err != nil {
			return nil, fmt.Errorf("failed to open listener on address %s: %w", hs.httpSrv.Addr, err)
		}
		return listener, nil
	case setting.SocketScheme:
		listener, err := net.ListenUnix("unix", &net.UnixAddr{Name: cfg.SocketPath, Net: "unix"})
		if err != nil {
			return nil, fmt.Errorf("failed to open listener for socket %s: %w", cfg.SocketPath, err)
		}

		// Make socket writable by group
		// nolint:gosec
		if err := os.Chmod(cfg.SocketPath, os.FileMode(cfg.SocketMode)); err != nil {
			return nil, fmt.Errorf("failed to change socket mode %d: %w", cfg.SocketMode, err)
		}

		// golang.org/pkg/os does not have chgrp
		// Changing the gid of a file without privileges requires that the target group is in the group of the process and that the process is the file owner
		if err := os.Chown(cfg.SocketPath, -1, cfg.SocketGid); err != nil {
			return nil, fmt.Errorf("failed to change socket group id %d: %w", cfg.SocketGid, err)
		}

		return listener, nil
	default:
		hs.log.Error("Invalid protocol", "protocol", cfg.Protocol)
		return nil, fmt.Errorf("invalid protocol %q", cfg.Protocol)
	}
}

func (hs *HTTPServer) selfSignedCert() ([]tls.Certificate, error) {
	cfg := hs.Cfg.Get()
	template := &x509.Certificate{
		IsCA:                  true,
		BasicConstraintsValid: true,
		SubjectKeyId:          []byte{1},
		SerialNumber:          big.NewInt(1),
		Subject: pkix.Name{
			CommonName: cfg.Domain,
		},
		NotBefore: time.Now(),
		NotAfter:  time.Now().AddDate(1, 0, 0),
		// see http://golang.org/pkg/crypto/x509/#KeyUsage
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth},
		KeyUsage:    x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
	}

	// generate private key
	privatekey, err := rsa.GenerateKey(rand.Reader, 4096)
	if err != nil {
		return nil, fmt.Errorf("error generating tls private key: %w", err)
	}

	publickey := &privatekey.PublicKey

	// create a self-signed certificate
	parent := template
	certBytes, err := x509.CreateCertificate(rand.Reader, template, parent, publickey, privatekey)
	if err != nil {
		return nil, fmt.Errorf("error generating tls self-signed certificate: %w", err)
	}

	// encode certificate and private key to PEM
	certPEM := new(bytes.Buffer)
	_ = pem.Encode(certPEM, &pem.Block{
		Type:  "CERTIFICATE",
		Bytes: certBytes,
	})

	certPrivKeyPEM := new(bytes.Buffer)
	_ = pem.Encode(certPrivKeyPEM, &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(privatekey),
	})

	// create tlsCertificate from generated certificate and private key
	tlsCert, err := tls.X509KeyPair(certPEM.Bytes(), certPrivKeyPEM.Bytes())
	if err != nil {
		return nil, fmt.Errorf("error creating tls self-signed certificate: %w", err)
	}

	return []tls.Certificate{tlsCert}, nil
}

func (hs *HTTPServer) tlsCertificates() ([]tls.Certificate, error) {
	cfg := hs.Cfg.Get()
	// if we don't have either a cert or key specified, generate a self-signed certificate
	if cfg.CertFile == "" && cfg.KeyFile == "" {
		return hs.selfSignedCert()
	}

	tlsCert, err := hs.readCertificates()
	if err != nil {
		return nil, err
	}
	hs.tlsCerts.certs = tlsCert

	if err := hs.updateMtimeOfServerCerts(); err != nil {
		return nil, err
	}
	return []tls.Certificate{*tlsCert}, nil
}

func (hs *HTTPServer) applyRoutes() {
	// start with middlewares & static routes
	hs.addMiddlewaresAndStaticRoutes()
	// then add view routes & api routes
	hs.RouteRegister.Register(hs.web, hs.namedMiddlewares...)
	// lastly not found route
	hs.web.NotFound(middleware.ProvideRouteOperationName("notfound"), middleware.ReqSignedIn, hs.NotFoundHandler)
}

func (hs *HTTPServer) addMiddlewaresAndStaticRoutes() {
	cfg := hs.Cfg.Get()
	m := hs.web

	m.Use(requestmeta.SetupRequestMetadata())
	m.Use(middleware.RequestTracing(hs.tracer, middleware.SkipTracingPaths))
	m.Use(middleware.RequestMetrics(hs.Features, hs.Cfg, hs.promRegister))

	m.UseMiddleware(hs.LoggerMiddleware.Middleware())

	if cfg.EnableGzip {
		m.UseMiddleware(middleware.Gziper())
	}

	m.UseMiddleware(middleware.Recovery(hs.Cfg, hs.License))
	m.UseMiddleware(hs.Csrf.Middleware())

	hs.mapStatic(m, cfg.StaticRootPath, "build", "public/build")
	hs.mapStatic(m, cfg.StaticRootPath, "", "public", "/public/views/swagger.html")
	hs.mapStatic(m, cfg.StaticRootPath, "robots.txt", "robots.txt")
	hs.mapStatic(m, cfg.StaticRootPath, "mockServiceWorker.js", "mockServiceWorker.js")

	if cfg.ImageUploadProvider == "local" {
		hs.mapStatic(m, cfg.ImagesDir, "", "/public/img/attachments")
	}

	if len(cfg.CustomResponseHeaders) > 0 {
		m.Use(middleware.AddCustomResponseHeaders(hs.Cfg))
	}

	m.Use(middleware.AddDefaultResponseHeaders(hs.Cfg))

	if cfg.ServeFromSubPath && cfg.AppSubURL != "" {
		m.SetURLPrefix(cfg.AppSubURL)
		m.UseMiddleware(middleware.SubPathRedirect(hs.Cfg))
	}

	m.UseMiddleware(web.Renderer(filepath.Join(cfg.StaticRootPath, "views"), "[[", "]]"))

	// These endpoints are used for monitoring the Grafana instance
	// and should not be redirected or rejected.
	m.Use(hs.healthzHandler)
	m.Use(hs.apiHealthHandler)
	m.Use(hs.metricsEndpoint)
	m.Use(hs.pluginMetricsEndpoint)
	m.Use(hs.frontendLogEndpoints())

	m.UseMiddleware(hs.ContextHandler.Middleware)
	m.Use(middleware.OrgRedirect(hs.Cfg, hs.userService))

	// needs to be after context handler
	if cfg.EnforceDomain {
		m.Use(middleware.ValidateHostHeader(cfg))
	}
	// handle action urls
	m.UseMiddleware(middleware.ValidateActionUrl(hs.Cfg, hs.log))

	m.Use(middleware.HandleNoCacheHeaders)

	if cfg.CSPEnabled || cfg.CSPReportOnlyEnabled {
		m.UseMiddleware(middleware.ContentSecurityPolicy(hs.Cfg, hs.log))
	}

	for _, mw := range hs.middlewares {
		m.Use(mw)
	}
}

func (hs *HTTPServer) metricsEndpoint(ctx *web.Context) {
	cfg := hs.Cfg.Get()
	if !cfg.MetricsEndpointEnabled {
		return
	}

	if ctx.Req.Method != http.MethodGet || ctx.Req.URL.Path != "/metrics" {
		return
	}

	if hs.metricsEndpointBasicAuthEnabled() && !BasicAuthenticatedRequest(ctx.Req, cfg.MetricsEndpointBasicAuthUsername, cfg.MetricsEndpointBasicAuthPassword) {
		ctx.Resp.Header().Set("WWW-Authenticate", `Basic realm="Grafana"`)
		ctx.Resp.WriteHeader(http.StatusUnauthorized)
		return
	}

	promhttp.
		HandlerFor(hs.promGatherer, promhttp.HandlerOpts{EnableOpenMetrics: true}).
		ServeHTTP(ctx.Resp, ctx.Req)
}

// healthzHandler always return 200 - Ok if Grafana's web server is running
func (hs *HTTPServer) healthzHandler(ctx *web.Context) {
	notHeadOrGet := ctx.Req.Method != http.MethodGet && ctx.Req.Method != http.MethodHead
	if notHeadOrGet || ctx.Req.URL.Path != "/healthz" {
		return
	}

	ctx.Resp.WriteHeader(http.StatusOK)
	if _, err := ctx.Resp.Write([]byte("Ok")); err != nil {
		hs.log.Error("could not write to response", "err", err)
	}
}

// swagger:model healthResponse
type healthResponse struct {
	Database         string `json:"database"`
	Version          string `json:"version,omitempty"`
	Commit           string `json:"commit,omitempty"`
	EnterpriseCommit string `json:"enterpriseCommit,omitempty"`
}

// swagger:route GET /health health getHealth
//
// apiHealthHandler will return ok if Grafana's web server is running and it
// can access the database. If the database cannot be accessed it will return
// http status code 503.
//
// Responses:
// 200: healthResponse
// 503: internalServerError
func (hs *HTTPServer) apiHealthHandler(ctx *web.Context) {
	cfg := hs.Cfg.Get()
	notHeadOrGet := ctx.Req.Method != http.MethodGet && ctx.Req.Method != http.MethodHead
	if notHeadOrGet || ctx.Req.URL.Path != "/api/health" {
		return
	}

	data := healthResponse{
		Database: "ok",
	}
	if !cfg.Anonymous.HideVersion {
		data.Version = cfg.BuildVersion
		data.Commit = cfg.BuildCommit
		if cfg.EnterpriseBuildCommit != "NA" && cfg.EnterpriseBuildCommit != "" {
			data.EnterpriseCommit = cfg.EnterpriseBuildCommit
		}
	}

	if !hs.databaseHealthy(ctx.Req.Context()) {
		data.Database = "failing"
		ctx.Resp.Header().Set("Content-Type", "application/json; charset=UTF-8")
		ctx.Resp.WriteHeader(http.StatusServiceUnavailable)
	} else {
		ctx.Resp.Header().Set("Content-Type", "application/json; charset=UTF-8")
		ctx.Resp.WriteHeader(http.StatusOK)
	}

	dataBytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		hs.log.Error("Failed to encode data", "err", err)
		return
	}

	if _, err := ctx.Resp.Write(dataBytes); err != nil {
		hs.log.Error("Failed to write to response", "err", err)
	}
}

func (hs *HTTPServer) mapStatic(m *web.Mux, rootDir string, dir string, prefix string, exclude ...string) {
	cfg := hs.Cfg.Get()
	headers := func(c *web.Context) {
		c.Resp.Header().Set("Cache-Control", "public, max-age=3600")
	}

	if prefix == "public/build" {
		headers = func(c *web.Context) {
			c.Resp.Header().Set("Cache-Control", "public, max-age=31536000")
		}
	}

	if cfg.Env == setting.Dev {
		headers = func(c *web.Context) {
			c.Resp.Header().Set("Cache-Control", "max-age=0, must-revalidate, no-cache")
		}
	}

	if prefix == "mockServiceWorker.js" {
		headers = func(c *web.Context) {
			c.Resp.Header().Set("Content-Type", "application/javascript")
		}
	}

	m.Use(httpstatic.Static(
		path.Join(rootDir, dir),
		httpstatic.StaticOptions{
			SkipLogging: true,
			Prefix:      prefix,
			AddHeaders:  headers,
			Exclude:     exclude,
		},
	))
}

func (hs *HTTPServer) metricsEndpointBasicAuthEnabled() bool {
	cfg := hs.Cfg.Get()
	return cfg.MetricsEndpointBasicAuthUsername != "" && cfg.MetricsEndpointBasicAuthPassword != ""
}

func (hs *HTTPServer) getDefaultCiphers(tlsVersion uint16, protocol string) []uint16 {
	if tlsVersion != tls.VersionTLS12 {
		return nil
	}
	if protocol == "https" {
		return []uint16{
			tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA,
			tls.TLS_RSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_RSA_WITH_AES_256_GCM_SHA384,
		}
	}
	if protocol == "h2" {
		return []uint16{
			tls.TLS_CHACHA20_POLY1305_SHA256,
			tls.TLS_AES_128_GCM_SHA256,
			tls.TLS_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
			tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
		}
	}
	return nil
}

func (hs *HTTPServer) readCertificates() (*tls.Certificate, error) {
	cfg := hs.Cfg.Get()
	if cfg.CertFile == "" {
		return nil, errors.New("cert_file cannot be empty when using HTTPS")
	}

	if cfg.KeyFile == "" {
		return nil, errors.New("cert_key cannot be empty when using HTTPS")
	}

	if _, err := os.Stat(cfg.CertFile); os.IsNotExist(err) {
		return nil, fmt.Errorf(`cannot find SSL cert_file at %q`, cfg.CertFile)
	}

	if _, err := os.Stat(cfg.KeyFile); os.IsNotExist(err) {
		return nil, fmt.Errorf(`cannot find SSL key_file at %q`, cfg.KeyFile)
	}

	if cfg.CertPassword != "" {
		return handleEncryptedCertificates(cfg)
	}
	// previous implementation
	tlsCert, err := tls.LoadX509KeyPair(cfg.CertFile, cfg.KeyFile)
	if err != nil {
		return nil, fmt.Errorf("could not load SSL certificate: %w", err)
	}
	return &tlsCert, nil
}

func handleEncryptedCertificates(cfg *setting.Cfg) (*tls.Certificate, error) {
	certKeyFilePassword := cfg.CertPassword
	certData, err := os.ReadFile(cfg.CertFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read certificate file: %w", err)
	}

	keyData, err := os.ReadFile(cfg.KeyFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read private key file: %w", err)
	}

	// handle encrypted private key
	keyPemBlock, _ := pem.Decode(keyData)

	var keyBytes []byte
	// Process the PKCS-encrypted PEM block.
	if strings.Contains(keyPemBlock.Type, "ENCRYPTED PRIVATE KEY") {
		// The pkcs8 package only handles the PKCS #5 v2.0 scheme.
		decrypted, err := pkcs8.ParsePKCS8PrivateKey(keyPemBlock.Bytes, []byte(certKeyFilePassword))
		if err != nil {
			return nil, fmt.Errorf("error parsing PKCS8 Private key: %w", err)
		}
		keyBytes, err = x509.MarshalPKCS8PrivateKey(decrypted)
		if err != nil {
			return nil, fmt.Errorf("error marshaling PKCS8 Private key: %w", err)
		}
	} else if strings.Contains(keyPemBlock.Type, "RSA PRIVATE KEY") {
		// Check if the PEM block is encrypted with PKCS#1
		// Even if these methods are deprecated, RSA PKCS#1 was requested by some customers and fairly used
		// nolint:staticcheck
		if !x509.IsEncryptedPEMBlock(keyPemBlock) {
			return nil, fmt.Errorf("password provided but Private key is not recorgnized as encrypted")
		}
		// Only covers encrypted PEM data with a DEK-Info header.
		// nolint:staticcheck
		keyBytes, err = x509.DecryptPEMBlock(keyPemBlock, []byte(certKeyFilePassword))
		if err != nil {
			return nil, fmt.Errorf("error decrypting x509 PemBlock: %w", err)
		}
	} else {
		return nil, fmt.Errorf("password provided but Private key is not encrypted or not supported")
	}

	var encodedKey bytes.Buffer
	err = pem.Encode(&encodedKey, &pem.Block{Type: keyPemBlock.Type, Bytes: keyBytes})
	if err != nil {
		return nil, fmt.Errorf("error encoding pem file: %w", err)
	}

	cert, err := tls.X509KeyPair(certData, encodedKey.Bytes())
	if err != nil {
		return nil, fmt.Errorf("failed to parse X509 key pair: %w", err)
	}
	return &cert, nil
}

func (hs *HTTPServer) configureTLS() error {
	cfg := hs.Cfg.Get()
	tlsCerts, err := hs.tlsCertificates()
	if err != nil {
		return err
	}

	minTlsVersion, err := util.TlsNameToVersion(cfg.MinTLSVersion)
	if err != nil {
		return err
	}

	tlsCiphers := hs.getDefaultCiphers(minTlsVersion, string(cfg.Protocol))

	hs.log.Info("HTTP Server TLS settings", "scheme", cfg.Protocol, "Min TLS Version", cfg.MinTLSVersion,
		"configured ciphers", util.TlsCipherIdsToString(tlsCiphers))

	tlsCfg := &tls.Config{
		Certificates: tlsCerts,
		MinVersion:   minTlsVersion,
		CipherSuites: tlsCiphers,
	}

	hs.httpSrv.TLSConfig = tlsCfg

	if cfg.Protocol == setting.HTTP2Scheme {
		hs.httpSrv.TLSConfig.NextProtos = []string{"h2", "http/1.1"}
	}

	if cfg.Protocol == setting.HTTPSScheme {
		hs.httpSrv.TLSNextProto = make(map[string]func(*http.Server, *tls.Conn, http.Handler))
	}

	return nil
}

func (hs *HTTPServer) GetCertificate(*tls.ClientHelloInfo) (*tls.Certificate, error) {
	hs.tlsCerts.certLock.RLock()
	defer hs.tlsCerts.certLock.RUnlock()

	tlsCerts := hs.tlsCerts.certs
	return tlsCerts, nil
}

// WatchAndUpdateCerts fsnotify module can be used to detect file changes and based on the event certs can be reloaded
// since it adds a direct dependency for the optional feature. So that is the reason periodic watching
// of cert files is chosen. If fsnotify is added as direct dependency in future, then the implementation
// can be revisited to align to fsnotify.
func (hs *HTTPServer) WatchAndUpdateCerts(ctx context.Context) {
	cfg := hs.Cfg.Get()
	ticker := time.NewTicker(cfg.CertWatchInterval)

	for {
		select {
		case <-ticker.C:
			if err := hs.updateCerts(); err != nil {
				hs.log.Error("Not able to reload certificates", "error", err)
			}
		case <-ctx.Done():
			hs.log.Debug("Stopping the CertWatchInterval ticker")
			ticker.Stop()
			return
		}
	}
}

func (hs *HTTPServer) updateCerts() error {
	cfg := hs.Cfg.Get()
	tlsInfo := &hs.tlsCerts
	cMtime, err := getMtime(cfg.CertFile)
	if err != nil {
		return err
	}
	kMtime, err := getMtime(cfg.KeyFile)
	if err != nil {
		return err
	}

	if cMtime.Compare(tlsInfo.certMtime) != 0 || kMtime.Compare(tlsInfo.keyMtime) != 0 {
		certs, err := hs.readCertificates()
		if err != nil {
			return err
		}
		tlsInfo.certLock.Lock()
		defer tlsInfo.certLock.Unlock()

		tlsInfo.certs = certs
		tlsInfo.certMtime = cMtime
		tlsInfo.keyMtime = kMtime
		hs.log.Info("Server certificates updated", "cMtime", tlsInfo.certMtime, "kMtime", tlsInfo.keyMtime)
	}
	return nil
}

func getMtime(name string) (time.Time, error) {
	fInfo, err := os.Stat(name)
	if err != nil {
		return time.Time{}, err
	}
	return fInfo.ModTime(), nil
}

func (hs *HTTPServer) updateMtimeOfServerCerts() error {
	cfg := hs.Cfg.Get()
	var err error
	hs.tlsCerts.certMtime, err = getMtime(cfg.CertFile)
	if err != nil {
		return err
	}

	hs.tlsCerts.keyMtime, err = getMtime(cfg.KeyFile)
	if err != nil {
		return err
	}

	return nil
}
