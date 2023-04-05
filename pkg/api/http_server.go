package api

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/grafana/grafana/pkg/api/avatar"
	"github.com/grafana/grafana/pkg/api/routing"
	httpstatic "github.com/grafana/grafana/pkg/api/static"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	loginpkg "github.com/grafana/grafana/pkg/login"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/middleware/csrf"
	"github.com/grafana/grafana/pkg/middleware/loggermw"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/registry/corekind"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/apikey"
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
	"github.com/grafana/grafana/pkg/services/datasources/permissions"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/export"
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
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	pluginSettings "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
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
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/star"
	starApi "github.com/grafana/grafana/pkg/services/star/api"
	"github.com/grafana/grafana/pkg/services/stats"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/store/entity/httpentitystore"
	"github.com/grafana/grafana/pkg/services/tag"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/teamguardian"
	tempUser "github.com/grafana/grafana/pkg/services/temp_user"
	"github.com/grafana/grafana/pkg/services/thumbs"
	"github.com/grafana/grafana/pkg/services/updatechecker"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
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

	PluginContextProvider        *plugincontext.Provider
	RouteRegister                routing.RouteRegister
	RenderService                rendering.Service
	Cfg                          *setting.Cfg
	Features                     *featuremgmt.FeatureManager
	SettingsProvider             setting.Provider
	HooksService                 *hooks.HooksService
	navTreeService               navtree.Service
	CacheService                 *localcache.CacheService
	DataSourceCache              datasources.CacheService
	AuthTokenService             auth.UserTokenService
	QuotaService                 quota.Service
	RemoteCacheService           *remotecache.RemoteCache
	ProvisioningService          provisioning.ProvisioningService
	Login                        login.Service
	License                      licensing.Licensing
	AccessControl                accesscontrol.AccessControl
	DataProxy                    *datasourceproxy.DataSourceProxyService
	PluginRequestValidator       validations.PluginRequestValidator
	pluginClient                 plugins.Client
	pluginStore                  plugins.Store
	pluginInstaller              plugins.Installer
	pluginFileStore              plugins.FileStore
	pluginDashboardService       plugindashboards.Service
	pluginStaticRouteResolver    plugins.StaticRouteResolver
	pluginErrorResolver          plugins.ErrorResolver
	SearchService                search.Service
	ShortURLService              shorturls.Service
	QueryHistoryService          queryhistory.Service
	CorrelationsService          correlations.Service
	Live                         *live.GrafanaLive
	LivePushGateway              *pushhttp.Gateway
	ThumbService                 thumbs.Service
	StorageService               store.StorageService
	httpEntityStore              httpentitystore.HTTPEntityStore
	SearchV2HTTPService          searchV2.SearchHTTPService
	ContextHandler               *contexthandler.ContextHandler
	LoggerMiddleware             loggermw.Logger
	SQLStore                     db.DB
	AlertEngine                  *alerting.AlertEngine
	AlertNG                      *ngalert.AlertNG
	LibraryPanelService          librarypanels.Service
	LibraryElementService        libraryelements.Service
	SocialService                social.Service
	Listener                     net.Listener
	EncryptionService            encryption.Internal
	SecretsService               secrets.Service
	secretsPluginManager         plugins.SecretsPluginManager
	secretsStore                 secretsKV.SecretsKVStore
	secretsMigrator              secrets.Migrator
	secretsPluginMigrator        spm.SecretMigrationProvider
	DataSourcesService           datasources.DataSourceService
	cleanUpService               *cleanup.CleanUpService
	tracer                       tracing.Tracer
	grafanaUpdateChecker         *updatechecker.GrafanaService
	pluginsUpdateChecker         *updatechecker.PluginsService
	searchUsersService           searchusers.Service
	teamGuardian                 teamguardian.TeamGuardian
	queryDataService             query.Service
	serviceAccountsService       serviceaccounts.Service
	authInfoService              login.AuthInfoService
	authenticator                loginpkg.Authenticator
	teamPermissionsService       accesscontrol.TeamPermissionsService
	NotificationService          *notifications.NotificationService
	DashboardService             dashboards.DashboardService
	dashboardProvisioningService dashboards.DashboardProvisioningService
	folderService                folder.Service
	DatasourcePermissionsService permissions.DatasourcePermissionsService
	AlertNotificationService     *alerting.AlertNotificationService
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
	Kinds                        *corekind.Base
	playlistService              playlist.Service
	apiKeyService                apikey.Service
	kvStore                      kvstore.KVStore
	pluginsCDNService            *pluginscdn.Service
	ExportService                export.ExportService

	userService            user.Service
	tempUserService        tempUser.Service
	dashboardThumbsService thumbs.DashboardThumbService
	loginAttemptService    loginAttempt.Service
	orgService             org.Service
	teamService            team.Service
	accesscontrolService   accesscontrol.Service
	annotationsRepo        annotations.Repository
	tagService             tag.Service
	oauthTokenService      oauthtoken.OAuthTokenService
	statsService           stats.Service
	authnService           authn.Service
	starApi                *starApi.API
}

type ServerOptions struct {
	Listener net.Listener
}

func ProvideHTTPServer(opts ServerOptions, cfg *setting.Cfg, routeRegister routing.RouteRegister, bus bus.Bus,
	renderService rendering.Service, licensing licensing.Licensing, hooksService *hooks.HooksService,
	cacheService *localcache.CacheService, sqlStore *sqlstore.SQLStore, alertEngine *alerting.AlertEngine,
	pluginRequestValidator validations.PluginRequestValidator, pluginStaticRouteResolver plugins.StaticRouteResolver,
	pluginDashboardService plugindashboards.Service, pluginStore plugins.Store, pluginClient plugins.Client,
	pluginErrorResolver plugins.ErrorResolver, pluginInstaller plugins.Installer, settingsProvider setting.Provider,
	dataSourceCache datasources.CacheService, userTokenService auth.UserTokenService,
	cleanUpService *cleanup.CleanUpService, shortURLService shorturls.Service, queryHistoryService queryhistory.Service, correlationsService correlations.Service,
	thumbService thumbs.Service, remoteCache *remotecache.RemoteCache, provisioningService provisioning.ProvisioningService,
	loginService login.Service, authenticator loginpkg.Authenticator, accessControl accesscontrol.AccessControl,
	dataSourceProxy *datasourceproxy.DataSourceProxyService, searchService *search.SearchService,
	live *live.GrafanaLive, livePushGateway *pushhttp.Gateway, plugCtxProvider *plugincontext.Provider,
	contextHandler *contexthandler.ContextHandler, loggerMiddleware loggermw.Logger, features *featuremgmt.FeatureManager,
	alertNG *ngalert.AlertNG, libraryPanelService librarypanels.Service, libraryElementService libraryelements.Service,
	quotaService quota.Service, socialService social.Service, tracer tracing.Tracer,
	encryptionService encryption.Internal, grafanaUpdateChecker *updatechecker.GrafanaService,
	pluginsUpdateChecker *updatechecker.PluginsService, searchUsersService searchusers.Service,
	dataSourcesService datasources.DataSourceService, queryDataService query.Service, pluginFileStore plugins.FileStore,
	teamGuardian teamguardian.TeamGuardian, serviceaccountsService serviceaccounts.Service,
	authInfoService login.AuthInfoService, storageService store.StorageService, httpEntityStore httpentitystore.HTTPEntityStore,
	notificationService *notifications.NotificationService, dashboardService dashboards.DashboardService,
	dashboardProvisioningService dashboards.DashboardProvisioningService, folderService folder.Service,
	datasourcePermissionsService permissions.DatasourcePermissionsService, alertNotificationService *alerting.AlertNotificationService,
	dashboardsnapshotsService dashboardsnapshots.Service, pluginSettings pluginSettings.Service,
	avatarCacheServer *avatar.AvatarCacheServer, preferenceService pref.Service,
	teamsPermissionsService accesscontrol.TeamPermissionsService, folderPermissionsService accesscontrol.FolderPermissionsService,
	dashboardPermissionsService accesscontrol.DashboardPermissionsService, dashboardVersionService dashver.Service,
	starService star.Service, csrfService csrf.Service, basekinds *corekind.Base,
	playlistService playlist.Service, apiKeyService apikey.Service, kvStore kvstore.KVStore,
	secretsMigrator secrets.Migrator, secretsPluginManager plugins.SecretsPluginManager, secretsService secrets.Service,
	secretsPluginMigrator spm.SecretMigrationProvider, secretsStore secretsKV.SecretsKVStore,
	publicDashboardsApi *publicdashboardsApi.Api, userService user.Service, tempUserService tempUser.Service,
	loginAttemptService loginAttempt.Service, orgService org.Service, teamService team.Service,
	accesscontrolService accesscontrol.Service, dashboardThumbsService thumbs.DashboardThumbService, navTreeService navtree.Service,
	annotationRepo annotations.Repository, tagService tag.Service, searchv2HTTPService searchV2.SearchHTTPService, oauthTokenService oauthtoken.OAuthTokenService,
	statsService stats.Service, authnService authn.Service, pluginsCDNService *pluginscdn.Service,
	starApi *starApi.API, exportService export.ExportService,
) (*HTTPServer, error) {
	web.Env = cfg.Env
	m := web.New()

	hs := &HTTPServer{
		Cfg:                          cfg,
		RouteRegister:                routeRegister,
		bus:                          bus,
		RenderService:                renderService,
		License:                      licensing,
		HooksService:                 hooksService,
		CacheService:                 cacheService,
		SQLStore:                     sqlStore,
		AlertEngine:                  alertEngine,
		PluginRequestValidator:       pluginRequestValidator,
		pluginInstaller:              pluginInstaller,
		pluginClient:                 pluginClient,
		pluginStore:                  pluginStore,
		pluginStaticRouteResolver:    pluginStaticRouteResolver,
		pluginDashboardService:       pluginDashboardService,
		pluginErrorResolver:          pluginErrorResolver,
		pluginFileStore:              pluginFileStore,
		grafanaUpdateChecker:         grafanaUpdateChecker,
		pluginsUpdateChecker:         pluginsUpdateChecker,
		SettingsProvider:             settingsProvider,
		DataSourceCache:              dataSourceCache,
		AuthTokenService:             userTokenService,
		cleanUpService:               cleanUpService,
		ShortURLService:              shortURLService,
		QueryHistoryService:          queryHistoryService,
		CorrelationsService:          correlationsService,
		Features:                     features,
		ThumbService:                 thumbService,
		StorageService:               storageService,
		RemoteCacheService:           remoteCache,
		ProvisioningService:          provisioningService,
		Login:                        loginService,
		AccessControl:                accessControl,
		DataProxy:                    dataSourceProxy,
		SearchV2HTTPService:          searchv2HTTPService,
		SearchService:                searchService,
		Live:                         live,
		LivePushGateway:              livePushGateway,
		PluginContextProvider:        plugCtxProvider,
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
		secretsPluginManager:         secretsPluginManager,
		secretsMigrator:              secretsMigrator,
		secretsPluginMigrator:        secretsPluginMigrator,
		secretsStore:                 secretsStore,
		httpEntityStore:              httpEntityStore,
		DataSourcesService:           dataSourcesService,
		searchUsersService:           searchUsersService,
		teamGuardian:                 teamGuardian,
		queryDataService:             queryDataService,
		serviceAccountsService:       serviceaccountsService,
		authInfoService:              authInfoService,
		authenticator:                authenticator,
		NotificationService:          notificationService,
		DashboardService:             dashboardService,
		dashboardProvisioningService: dashboardProvisioningService,
		folderService:                folderService,
		DatasourcePermissionsService: datasourcePermissionsService,
		teamPermissionsService:       teamsPermissionsService,
		AlertNotificationService:     alertNotificationService,
		dashboardsnapshotsService:    dashboardsnapshotsService,
		PluginSettings:               pluginSettings,
		AvatarCacheServer:            avatarCacheServer,
		preferenceService:            preferenceService,
		Csrf:                         csrfService,
		folderPermissionsService:     folderPermissionsService,
		dashboardPermissionsService:  dashboardPermissionsService,
		dashboardVersionService:      dashboardVersionService,
		starService:                  starService,
		Kinds:                        basekinds,
		playlistService:              playlistService,
		apiKeyService:                apiKeyService,
		kvStore:                      kvStore,
		PublicDashboardsApi:          publicDashboardsApi,
		userService:                  userService,
		tempUserService:              tempUserService,
		dashboardThumbsService:       dashboardThumbsService,
		loginAttemptService:          loginAttemptService,
		orgService:                   orgService,
		teamService:                  teamService,
		navTreeService:               navTreeService,
		accesscontrolService:         accesscontrolService,
		annotationsRepo:              annotationRepo,
		tagService:                   tagService,
		oauthTokenService:            oauthTokenService,
		statsService:                 statsService,
		authnService:                 authnService,
		pluginsCDNService:            pluginsCDNService,
		starApi:                      starApi,
		ExportService:                exportService,
	}
	if hs.Listener != nil {
		hs.log.Debug("Using provided listener")
	}
	hs.registerRoutes()

	// Register access control scope resolver for annotations
	hs.AccessControl.RegisterScopeAttributeResolver(AnnotationTypeScopeResolver(hs.annotationsRepo))

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
	hs.context = ctx

	hs.applyRoutes()

	// Remove any square brackets enclosing IPv6 addresses, a format we support for backwards compatibility
	host := strings.TrimSuffix(strings.TrimPrefix(hs.Cfg.HTTPAddr, "["), "]")
	hs.httpSrv = &http.Server{
		Addr:        net.JoinHostPort(host, hs.Cfg.HTTPPort),
		Handler:     hs.web,
		ReadTimeout: hs.Cfg.ReadTimeout,
	}
	switch hs.Cfg.Protocol {
	case setting.HTTP2Scheme:
		if err := hs.configureHttp2(); err != nil {
			return err
		}
	case setting.HTTPSScheme:
		if err := hs.configureHttps(); err != nil {
			return err
		}
	default:
	}

	listener, err := hs.getListener()
	if err != nil {
		return err
	}

	hs.log.Info("HTTP Server Listen", "address", listener.Addr().String(), "protocol",
		hs.Cfg.Protocol, "subUrl", hs.Cfg.AppSubURL, "socket", hs.Cfg.SocketPath)

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

	switch hs.Cfg.Protocol {
	case setting.HTTPScheme, setting.SocketScheme:
		if err := hs.httpSrv.Serve(listener); err != nil {
			if errors.Is(err, http.ErrServerClosed) {
				hs.log.Debug("server was shutdown gracefully")
				return nil
			}
			return err
		}
	case setting.HTTP2Scheme, setting.HTTPSScheme:
		if err := hs.httpSrv.ServeTLS(listener, hs.Cfg.CertFile, hs.Cfg.KeyFile); err != nil {
			if errors.Is(err, http.ErrServerClosed) {
				hs.log.Debug("server was shutdown gracefully")
				return nil
			}
			return err
		}
	default:
		panic(fmt.Sprintf("Unhandled protocol %q", hs.Cfg.Protocol))
	}

	wg.Wait()

	return nil
}

func (hs *HTTPServer) getListener() (net.Listener, error) {
	if hs.Listener != nil {
		return hs.Listener, nil
	}

	switch hs.Cfg.Protocol {
	case setting.HTTPScheme, setting.HTTPSScheme, setting.HTTP2Scheme:
		listener, err := net.Listen("tcp", hs.httpSrv.Addr)
		if err != nil {
			return nil, fmt.Errorf("failed to open listener on address %s: %w", hs.httpSrv.Addr, err)
		}
		return listener, nil
	case setting.SocketScheme:
		listener, err := net.ListenUnix("unix", &net.UnixAddr{Name: hs.Cfg.SocketPath, Net: "unix"})
		if err != nil {
			return nil, fmt.Errorf("failed to open listener for socket %s: %w", hs.Cfg.SocketPath, err)
		}

		// Make socket writable by group
		// nolint:gosec
		if err := os.Chmod(hs.Cfg.SocketPath, os.FileMode(hs.Cfg.SocketMode)); err != nil {
			return nil, fmt.Errorf("failed to change socket mode %d: %w", hs.Cfg.SocketMode, err)
		}

		// golang.org/pkg/os does not have chgrp
		// Changing the gid of a file without privileges requires that the target group is in the group of the process and that the process is the file owner
		if err := os.Chown(hs.Cfg.SocketPath, -1, hs.Cfg.SocketGid); err != nil {
			return nil, fmt.Errorf("failed to change socket group id %d: %w", hs.Cfg.SocketGid, err)
		}

		return listener, nil
	default:
		hs.log.Error("Invalid protocol", "protocol", hs.Cfg.Protocol)
		return nil, fmt.Errorf("invalid protocol %q", hs.Cfg.Protocol)
	}
}

func (hs *HTTPServer) configureHttps() error {
	if hs.Cfg.CertFile == "" {
		return errors.New("cert_file cannot be empty when using HTTPS")
	}

	if hs.Cfg.KeyFile == "" {
		return errors.New("cert_key cannot be empty when using HTTPS")
	}

	if _, err := os.Stat(hs.Cfg.CertFile); os.IsNotExist(err) {
		return fmt.Errorf(`cannot find SSL cert_file at %q`, hs.Cfg.CertFile)
	}

	if _, err := os.Stat(hs.Cfg.KeyFile); os.IsNotExist(err) {
		return fmt.Errorf(`cannot find SSL key_file at %q`, hs.Cfg.KeyFile)
	}

	tlsCfg := &tls.Config{
		MinVersion: tls.VersionTLS12,
		CipherSuites: []uint16{
			tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA,
			tls.TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA,
			tls.TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA,
			tls.TLS_RSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_RSA_WITH_AES_128_CBC_SHA,
			tls.TLS_RSA_WITH_AES_256_CBC_SHA,
		},
	}

	hs.httpSrv.TLSConfig = tlsCfg
	hs.httpSrv.TLSNextProto = make(map[string]func(*http.Server, *tls.Conn, http.Handler))

	return nil
}

func (hs *HTTPServer) configureHttp2() error {
	if hs.Cfg.CertFile == "" {
		return errors.New("cert_file cannot be empty when using HTTP2")
	}

	if hs.Cfg.KeyFile == "" {
		return errors.New("cert_key cannot be empty when using HTTP2")
	}

	if _, err := os.Stat(hs.Cfg.CertFile); os.IsNotExist(err) {
		return fmt.Errorf("cannot find SSL cert_file at %q", hs.Cfg.CertFile)
	}

	if _, err := os.Stat(hs.Cfg.KeyFile); os.IsNotExist(err) {
		return fmt.Errorf("cannot find SSL key_file at %q", hs.Cfg.KeyFile)
	}

	tlsCfg := &tls.Config{
		MinVersion: tls.VersionTLS12,
		CipherSuites: []uint16{
			tls.TLS_CHACHA20_POLY1305_SHA256,
			tls.TLS_AES_128_GCM_SHA256,
			tls.TLS_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
			tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
		},
		NextProtos: []string{"h2", "http/1.1"},
	}

	hs.httpSrv.TLSConfig = tlsCfg

	return nil
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
	m := hs.web

	m.Use(middleware.RequestTracing(hs.tracer))
	m.Use(middleware.RequestMetrics(hs.Features))

	m.UseMiddleware(hs.LoggerMiddleware.Middleware())

	if hs.Cfg.EnableGzip {
		m.UseMiddleware(middleware.Gziper())
	}

	m.UseMiddleware(middleware.Recovery(hs.Cfg))
	m.UseMiddleware(hs.Csrf.Middleware())

	hs.mapStatic(m, hs.Cfg.StaticRootPath, "build", "public/build")
	hs.mapStatic(m, hs.Cfg.StaticRootPath, "", "public", "/public/views/swagger.html")
	hs.mapStatic(m, hs.Cfg.StaticRootPath, "robots.txt", "robots.txt")

	if hs.Cfg.ImageUploadProvider == "local" {
		hs.mapStatic(m, hs.Cfg.ImagesDir, "", "/public/img/attachments")
	}

	if len(hs.Cfg.CustomResponseHeaders) > 0 {
		m.Use(middleware.AddCustomResponseHeaders(hs.Cfg))
	}

	m.Use(middleware.AddDefaultResponseHeaders(hs.Cfg))

	if hs.Cfg.ServeFromSubPath && hs.Cfg.AppSubURL != "" {
		m.SetURLPrefix(hs.Cfg.AppSubURL)
	}

	m.UseMiddleware(web.Renderer(filepath.Join(hs.Cfg.StaticRootPath, "views"), "[[", "]]"))

	// These endpoints are used for monitoring the Grafana instance
	// and should not be redirected or rejected.
	m.Use(hs.healthzHandler)
	m.Use(hs.apiHealthHandler)
	m.Use(hs.metricsEndpoint)
	m.Use(hs.pluginMetricsEndpoint)
	m.Use(hs.frontendLogEndpoints())

	m.UseMiddleware(hs.ContextHandler.Middleware)
	m.Use(middleware.OrgRedirect(hs.Cfg, hs.userService))
	if !hs.Features.IsEnabled(featuremgmt.FlagAuthnService) {
		m.Use(accesscontrol.LoadPermissionsMiddleware(hs.accesscontrolService))
	}

	// needs to be after context handler
	if hs.Cfg.EnforceDomain {
		m.Use(middleware.ValidateHostHeader(hs.Cfg))
	}

	m.Use(middleware.HandleNoCacheHeader)

	if hs.Cfg.CSPEnabled || hs.Cfg.CSPReportOnlyEnabled {
		m.UseMiddleware(middleware.ContentSecurityPolicy(hs.Cfg, hs.log))
	}

	for _, mw := range hs.middlewares {
		m.Use(mw)
	}
}

func (hs *HTTPServer) metricsEndpoint(ctx *web.Context) {
	if !hs.Cfg.MetricsEndpointEnabled {
		return
	}

	if ctx.Req.Method != http.MethodGet || ctx.Req.URL.Path != "/metrics" {
		return
	}

	if hs.metricsEndpointBasicAuthEnabled() && !BasicAuthenticatedRequest(ctx.Req, hs.Cfg.MetricsEndpointBasicAuthUsername, hs.Cfg.MetricsEndpointBasicAuthPassword) {
		ctx.Resp.WriteHeader(http.StatusUnauthorized)
		return
	}

	promhttp.
		HandlerFor(prometheus.DefaultGatherer, promhttp.HandlerOpts{EnableOpenMetrics: true}).
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

// apiHealthHandler will return ok if Grafana's web server is running and it
// can access the database. If the database cannot be accessed it will return
// http status code 503.
func (hs *HTTPServer) apiHealthHandler(ctx *web.Context) {
	notHeadOrGet := ctx.Req.Method != http.MethodGet && ctx.Req.Method != http.MethodHead
	if notHeadOrGet || ctx.Req.URL.Path != "/api/health" {
		return
	}

	data := simplejson.New()
	data.Set("database", "ok")
	if !hs.Cfg.AnonymousHideVersion {
		data.Set("version", hs.Cfg.BuildVersion)
		data.Set("commit", hs.Cfg.BuildCommit)
	}

	if !hs.databaseHealthy(ctx.Req.Context()) {
		data.Set("database", "failing")
		ctx.Resp.Header().Set("Content-Type", "application/json; charset=UTF-8")
		ctx.Resp.WriteHeader(http.StatusServiceUnavailable)
	} else {
		ctx.Resp.Header().Set("Content-Type", "application/json; charset=UTF-8")
		ctx.Resp.WriteHeader(http.StatusOK)
	}

	dataBytes, err := data.EncodePretty()
	if err != nil {
		hs.log.Error("Failed to encode data", "err", err)
		return
	}

	if _, err := ctx.Resp.Write(dataBytes); err != nil {
		hs.log.Error("Failed to write to response", "err", err)
	}
}

func (hs *HTTPServer) mapStatic(m *web.Mux, rootDir string, dir string, prefix string, exclude ...string) {
	headers := func(c *web.Context) {
		c.Resp.Header().Set("Cache-Control", "public, max-age=3600")
	}

	if prefix == "public/build" {
		headers = func(c *web.Context) {
			c.Resp.Header().Set("Cache-Control", "public, max-age=31536000")
		}
	}

	if hs.Cfg.Env == setting.Dev {
		headers = func(c *web.Context) {
			c.Resp.Header().Set("Cache-Control", "max-age=0, must-revalidate, no-cache")
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
	return hs.Cfg.MetricsEndpointBasicAuthUsername != "" && hs.Cfg.MetricsEndpointBasicAuthPassword != ""
}
