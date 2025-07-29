package live

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/centrifugal/centrifuge"
	"github.com/go-redis/redis/v8"
	"github.com/gobwas/glob"
	jsoniter "github.com/json-iterator/go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/live"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/apiserver"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/live/database"
	"github.com/grafana/grafana/pkg/services/live/features"
	"github.com/grafana/grafana/pkg/services/live/livecontext"
	"github.com/grafana/grafana/pkg/services/live/liveplugin"
	"github.com/grafana/grafana/pkg/services/live/managedstream"
	"github.com/grafana/grafana/pkg/services/live/model"
	"github.com/grafana/grafana/pkg/services/live/orgchannel"
	"github.com/grafana/grafana/pkg/services/live/pipeline"
	"github.com/grafana/grafana/pkg/services/live/pushws"
	"github.com/grafana/grafana/pkg/services/live/runstream"
	"github.com/grafana/grafana/pkg/services/live/survey"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

var (
	logger   = log.New("live")
	loggerCF = log.New("live.centrifuge")
	tracer   = otel.Tracer("github.com/grafana/grafana/pkg/services/live")
)

// CoreGrafanaScope list of core features
type CoreGrafanaScope struct {
	Features map[string]model.ChannelHandlerFactory

	// The generic service to advertise dashboard changes
	Dashboards DashboardActivityChannel
}

func ProvideService(plugCtxProvider *plugincontext.Provider, cfg *setting.Cfg, routeRegister routing.RouteRegister,
	pluginStore pluginstore.Store, pluginClient plugins.Client, cacheService *localcache.CacheService,
	dataSourceCache datasources.CacheService, sqlStore db.DB, secretsService secrets.Service,
	usageStatsService usagestats.Service, queryDataService query.Service, toggles featuremgmt.FeatureToggles,
	accessControl accesscontrol.AccessControl, dashboardService dashboards.DashboardService, annotationsRepo annotations.Repository,
	orgService org.Service, configProvider apiserver.RestConfigProvider) (*GrafanaLive, error) {
	g := &GrafanaLive{
		Cfg:                   cfg,
		Features:              toggles,
		PluginContextProvider: plugCtxProvider,
		RouteRegister:         routeRegister,
		pluginStore:           pluginStore,
		pluginClient:          pluginClient,
		CacheService:          cacheService,
		DataSourceCache:       dataSourceCache,
		SQLStore:              sqlStore,
		SecretsService:        secretsService,
		queryDataService:      queryDataService,
		channels:              make(map[string]model.ChannelHandler),
		GrafanaScope: CoreGrafanaScope{
			Features: make(map[string]model.ChannelHandlerFactory),
		},
		usageStatsService: usageStatsService,
		orgService:        orgService,
		keyPrefix:         "gf_live",
	}

	if cfg.LiveHAPrefix != "" {
		g.keyPrefix = cfg.LiveHAPrefix + ".gf_live"
	}

	logger.Debug("GrafanaLive initialization", "ha", g.IsHA())

	// Node is the core object in Centrifuge library responsible for many useful
	// things. For example Node allows to publish messages to channels from server
	// side with its Publish method.
	node, err := centrifuge.New(centrifuge.Config{
		LogHandler: handleLog,
		LogLevel:   centrifuge.LogLevelError,
		Metrics: centrifuge.MetricsConfig{
			MetricsNamespace: "grafana_live",
		},
		ClientQueueMaxSize: 4194304, // 4MB
		// Use reasonably large expiration interval for stream meta key,
		// much bigger than maximum HistoryLifetime value in Node config.
		// This way stream meta data will expire, in some cases you may want
		// to prevent its expiration setting this to zero value.
		HistoryMetaTTL: 7 * 24 * time.Hour,
	})
	if err != nil {
		return nil, err
	}
	g.node = node

	redisHealthy := false
	if g.IsHA() {
		// Configure HA with Redis. In this case Centrifuge nodes
		// will be connected over Redis PUB/SUB. Presence will work
		// globally since kept inside Redis.
		err := setupRedisLiveEngine(g, node)
		if err != nil {
			logger.Error("failed to setup redis live engine", "error", err)
		} else {
			redisHealthy = true
		}
	}

	channelLocalPublisher := liveplugin.NewChannelLocalPublisher(node, nil)

	var managedStreamRunner *managedstream.Runner
	var redisClient *redis.Client
	if g.IsHA() && redisHealthy {
		redisClient = redis.NewClient(&redis.Options{
			Addr:     g.Cfg.LiveHAEngineAddress,
			Password: g.Cfg.LiveHAEnginePassword,
		})
		cmd := redisClient.Ping(context.Background())
		if _, err := cmd.Result(); err != nil {
			logger.Error("live engine failed to ping redis, proceeding without live ha", "error", err)
			redisClient = nil
		}
	}

	if redisClient != nil {
		managedStreamRunner = managedstream.NewRunner(
			g.Publish,
			channelLocalPublisher,
			managedstream.NewRedisFrameCache(redisClient, g.keyPrefix),
		)
	} else {
		managedStreamRunner = managedstream.NewRunner(
			g.Publish,
			channelLocalPublisher,
			managedstream.NewMemoryFrameCache(),
		)
	}

	g.ManagedStreamRunner = managedStreamRunner

	g.contextGetter = liveplugin.NewContextGetter(g.PluginContextProvider, g.DataSourceCache)
	pipelinedChannelLocalPublisher := liveplugin.NewChannelLocalPublisher(node, g.Pipeline)
	numLocalSubscribersGetter := liveplugin.NewNumLocalSubscribersGetter(node)
	g.runStreamManager = runstream.NewManager(pipelinedChannelLocalPublisher, numLocalSubscribersGetter, g.contextGetter)

	// Initialize the main features
	dash := &features.DashboardHandler{
		Publisher:        g.Publish,
		ClientCount:      g.ClientCount,
		Store:            sqlStore,
		DashboardService: dashboardService,
		AccessControl:    accessControl,
	}
	g.storage = database.NewStorage(g.SQLStore, g.CacheService)
	g.GrafanaScope.Dashboards = dash
	g.GrafanaScope.Features["dashboard"] = dash
	g.GrafanaScope.Features["broadcast"] = features.NewBroadcastRunner(g.storage)

	// Testing watch with just the provisioning support -- this will be removed when it is well validated
	if toggles.IsEnabledGlobally(featuremgmt.FlagProvisioning) {
		g.GrafanaScope.Features["watch"] = features.NewWatchRunner(g.Publish, configProvider)
	}

	g.surveyCaller = survey.NewCaller(managedStreamRunner, node)
	err = g.surveyCaller.SetupHandlers()
	if err != nil {
		return nil, err
	}

	// Set ConnectHandler called when client successfully connected to Node. Your code
	// inside handler must be synchronized since it will be called concurrently from
	// different goroutines (belonging to different client connections). This is also
	// true for other event handlers.
	node.OnConnect(func(client *centrifuge.Client) {
		_, connectSpan := tracer.Start(client.Context(), "live.OnConnect")
		defer connectSpan.End()
		connectSpan.SetAttributes(
			attribute.String("user", client.UserID()),
			attribute.String("client", client.ID()),
		)

		numConnections := g.node.Hub().NumClients()
		if g.Cfg.LiveMaxConnections >= 0 && numConnections > g.Cfg.LiveMaxConnections {
			logger.Warn(
				"Max number of Live connections reached, increase max_connections in [live] configuration section",
				"user", client.UserID(), "client", client.ID(), "limit", g.Cfg.LiveMaxConnections,
			)
			connectSpan.AddEvent("disconnect", trace.WithAttributes(attribute.String("reason", "connection limit reached")))
			client.Disconnect(centrifuge.DisconnectConnectionLimit)
			return
		}
		var semaphore chan struct{}
		if clientConcurrency > 1 {
			semaphore = make(chan struct{}, clientConcurrency)
		}
		logger.Debug("Client connected", "user", client.UserID(), "client", client.ID())
		connectedAt := time.Now()

		// Called when client issues RPC (async request over Live connection).
		client.OnRPC(func(e centrifuge.RPCEvent, cb centrifuge.RPCCallback) {
			ctx, span := tracer.Start(client.Context(), "live.OnRPC")
			// We finish span when calling callback, which can be done on a separate goroutine.

			span.SetAttributes(
				attribute.String("method", e.Method),
				attribute.String("data", string(e.Data)),
			)

			cbWithSpan := func(resp centrifuge.RPCReply, err error) {
				defer span.End()
				if err != nil {
					span.SetStatus(codes.Error, err.Error())
				} else {
					span.AddEvent("result", trace.WithAttributes(attribute.String("data", string(resp.Data))))
					span.SetStatus(codes.Ok, "")
				}
				cb(resp, err)
			}

			err := runConcurrentlyIfNeeded(ctx, semaphore, func() {
				cbWithSpan(g.handleOnRPC(ctx, client, e))
			})
			if err != nil {
				cbWithSpan(centrifuge.RPCReply{}, err)
			}
		})

		// Called when client subscribes to the channel.
		client.OnSubscribe(func(e centrifuge.SubscribeEvent, cb centrifuge.SubscribeCallback) {
			ctx, span := tracer.Start(client.Context(), "live.OnSubscribe")
			// We finish span when calling callback, which can be done on a separate goroutine.

			span.SetAttributes(
				attribute.String("channel", e.Channel),
				attribute.String("data", string(e.Data)),
			)

			cbWithSpan := func(resp centrifuge.SubscribeReply, err error) {
				defer span.End()
				if err != nil {
					span.SetStatus(codes.Error, err.Error())
				} else {
					span.SetStatus(codes.Ok, "")
				}
				cb(resp, err)
			}

			err := runConcurrentlyIfNeeded(ctx, semaphore, func() {
				cbWithSpan(g.handleOnSubscribe(ctx, client, e))
			})
			if err != nil {
				cbWithSpan(centrifuge.SubscribeReply{}, err)
			}
		})

		// Called when a client publishes to the channel.
		// In general, we should prefer writing to the HTTP API, but this
		// allows some simple prototypes to work quickly.
		client.OnPublish(func(e centrifuge.PublishEvent, cb centrifuge.PublishCallback) {
			ctx, span := tracer.Start(client.Context(), "live.OnPublish")
			// We finish span when calling callback, which can be done on a separate goroutine.

			span.SetAttributes(
				attribute.String("channel", e.Channel),
				attribute.String("data", string(e.Data)),
			)

			cbWithSpan := func(resp centrifuge.PublishReply, err error) {
				defer span.End()
				if err != nil {
					span.SetStatus(codes.Error, err.Error())
				} else {
					span.SetStatus(codes.Ok, "")
				}
				cb(resp, err)
			}

			err := runConcurrentlyIfNeeded(ctx, semaphore, func() {
				cbWithSpan(g.handleOnPublish(ctx, client, e))
			})
			if err != nil {
				cbWithSpan(centrifuge.PublishReply{}, err)
			}
		})

		// We don't need to do anything on unsubscribe, but we create tracing span with channel name.
		client.OnUnsubscribe(func(e centrifuge.UnsubscribeEvent) {
			_, span := tracer.Start(client.Context(), "live.OnUnsubscribe")
			defer span.End()

			span.SetAttributes(
				attribute.String("channel", e.Channel),
			)
		})

		client.OnDisconnect(func(e centrifuge.DisconnectEvent) {
			_, span := tracer.Start(client.Context(), "live.OnDisconnect")
			defer span.End()

			reason := e.Reason
			if e.Code == 3001 { // Shutdown
				return
			}
			logger.Debug("Client disconnected", "user", client.UserID(), "client", client.ID(), "reason", reason, "elapsed", time.Since(connectedAt))
		})
	})

	// Run node. This method does not block.
	if err := node.Run(); err != nil {
		return nil, err
	}

	appURL, err := url.Parse(g.Cfg.AppURL)
	if err != nil {
		return nil, fmt.Errorf("error parsing AppURL %s: %w", g.Cfg.AppURL, err)
	}

	originPatterns := g.Cfg.LiveAllowedOrigins
	originGlobs, _ := setting.GetAllowedOriginGlobs(originPatterns) // error already checked on config load.
	checkOrigin := getCheckOriginFunc(appURL, originPatterns, originGlobs)

	wsCfg := centrifuge.WebsocketConfig{
		ReadBufferSize:   1024,
		WriteBufferSize:  1024,
		CheckOrigin:      checkOrigin,
		MessageSizeLimit: cfg.LiveMessageSizeLimit,
	}
	// Use a pure websocket transport.
	wsHandler := centrifuge.NewWebsocketHandler(node, wsCfg)

	pushWSHandler := pushws.NewHandler(g.ManagedStreamRunner, pushws.Config{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     checkOrigin,
	})

	pushPipelineWSHandler := pushws.NewPipelinePushHandler(g.Pipeline, pushws.Config{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     checkOrigin,
	})

	g.websocketHandler = func(ctx *contextmodel.ReqContext) {
		user := ctx.SignedInUser
		id, _ := user.GetInternalID()
		// Centrifuge expects Credentials in context with a current user ID.
		cred := &centrifuge.Credentials{
			UserID: strconv.FormatInt(id, 10),
		}
		newCtx := centrifuge.SetCredentials(ctx.Req.Context(), cred)
		newCtx = livecontext.SetContextSignedUser(newCtx, user)
		r := ctx.Req.WithContext(newCtx)
		wsHandler.ServeHTTP(ctx.Resp, r)
	}

	g.pushWebsocketHandler = func(ctx *contextmodel.ReqContext) {
		user := ctx.SignedInUser
		newCtx := livecontext.SetContextSignedUser(ctx.Req.Context(), user)
		newCtx = livecontext.SetContextStreamID(newCtx, web.Params(ctx.Req)[":streamId"])
		r := ctx.Req.WithContext(newCtx)
		pushWSHandler.ServeHTTP(ctx.Resp, r)
	}

	g.pushPipelineWebsocketHandler = func(ctx *contextmodel.ReqContext) {
		user := ctx.SignedInUser
		newCtx := livecontext.SetContextSignedUser(ctx.Req.Context(), user)
		newCtx = livecontext.SetContextChannelID(newCtx, web.Params(ctx.Req)["*"])
		r := ctx.Req.WithContext(newCtx)
		pushPipelineWSHandler.ServeHTTP(ctx.Resp, r)
	}

	g.RouteRegister.Group("/api/live", func(group routing.RouteRegister) {
		group.Get("/ws", g.websocketHandler)
	}, middleware.ReqSignedIn, requestmeta.SetSLOGroup(requestmeta.SLOGroupNone))

	g.RouteRegister.Group("/api/live", func(group routing.RouteRegister) {
		group.Get("/push/:streamId", g.pushWebsocketHandler)
		group.Get("/pipeline/push/*", g.pushPipelineWebsocketHandler)
	}, middleware.ReqOrgAdmin, requestmeta.SetSLOGroup(requestmeta.SLOGroupNone))

	g.registerUsageMetrics()

	return g, nil
}

func setupRedisLiveEngine(g *GrafanaLive, node *centrifuge.Node) error {
	redisAddress := g.Cfg.LiveHAEngineAddress
	redisPassword := g.Cfg.LiveHAEnginePassword
	redisShardConfigs := []centrifuge.RedisShardConfig{
		{Address: redisAddress, Password: redisPassword},
	}

	redisShards := make([]*centrifuge.RedisShard, 0, len(redisShardConfigs))
	for _, redisConf := range redisShardConfigs {
		redisShard, err := centrifuge.NewRedisShard(node, redisConf)
		if err != nil {
			return fmt.Errorf("error connecting to Live Redis: %v", err)
		}

		redisShards = append(redisShards, redisShard)
	}

	broker, err := centrifuge.NewRedisBroker(node, centrifuge.RedisBrokerConfig{
		Prefix: g.keyPrefix,
		Shards: redisShards,
	})
	if err != nil {
		return fmt.Errorf("error creating Live Redis broker: %v", err)
	}

	node.SetBroker(broker)

	presenceManager, err := centrifuge.NewRedisPresenceManager(node, centrifuge.RedisPresenceManagerConfig{
		Prefix: g.keyPrefix,
		Shards: redisShards,
	})
	if err != nil {
		return fmt.Errorf("error creating Live Redis presence manager: %v", err)
	}

	node.SetPresenceManager(presenceManager)

	return nil
}

// GrafanaLive manages live real-time connections to Grafana (over WebSocket at this moment).
// The main concept here is Channel. Connections can subscribe to many channels. Each channel
// can have different permissions and properties but once a connection subscribed to a channel
// it starts receiving all messages published into this channel. Thus GrafanaLive is a PUB/SUB
// server.
type GrafanaLive struct {
	PluginContextProvider *plugincontext.Provider
	Cfg                   *setting.Cfg
	Features              featuremgmt.FeatureToggles
	RouteRegister         routing.RouteRegister
	CacheService          *localcache.CacheService
	DataSourceCache       datasources.CacheService
	SQLStore              db.DB
	SecretsService        secrets.Service
	pluginStore           pluginstore.Store
	pluginClient          plugins.Client
	queryDataService      query.Service
	orgService            org.Service

	keyPrefix string

	node         *centrifuge.Node
	surveyCaller *survey.Caller

	// Websocket handlers
	websocketHandler             interface{}
	pushWebsocketHandler         interface{}
	pushPipelineWebsocketHandler interface{}

	// Full channel handler
	channels   map[string]model.ChannelHandler
	channelsMu sync.RWMutex

	// The core internal features
	GrafanaScope CoreGrafanaScope

	ManagedStreamRunner *managedstream.Runner
	Pipeline            *pipeline.Pipeline
	pipelineStorage     pipeline.Storage

	contextGetter    *liveplugin.ContextGetter
	runStreamManager *runstream.Manager
	storage          *database.Storage

	usageStatsService usagestats.Service
	usageStats        usageStats
}

// DashboardActivityChannel is a service to advertise dashboard activity
type DashboardActivityChannel interface {
	// Called when a dashboard is saved -- this includes the error so we can support a
	// gitops workflow that knows if the value was saved to the local database or not
	// in many cases all direct save requests will fail, but the request should be forwarded
	// to any gitops observers
	DashboardSaved(orgID int64, requester identity.Requester, message string, dashboard *dashboards.Dashboard, err error) error

	// Called when a dashboard is deleted
	DashboardDeleted(orgID int64, requester identity.Requester, uid string) error

	// Experimental! Indicate is GitOps is active.  This really means
	// someone is subscribed to the `grafana/dashboards/gitops` channel
	HasGitOpsObserver(orgID int64) bool
}

func (g *GrafanaLive) getStreamPlugin(ctx context.Context, pluginID string) (backend.StreamHandler, error) {
	plugin, exists := g.pluginStore.Plugin(ctx, pluginID)
	if !exists {
		return nil, fmt.Errorf("plugin not found: %s", pluginID)
	}
	if plugin.SupportsStreaming() {
		return g.pluginClient, nil
	}
	return nil, fmt.Errorf("%s plugin does not implement StreamHandler: %#v", pluginID, plugin)
}

func (g *GrafanaLive) Run(ctx context.Context) error {
	eGroup, eCtx := errgroup.WithContext(ctx)

	eGroup.Go(func() error {
		updateStatsTicker := time.NewTicker(time.Minute * 30)
		defer updateStatsTicker.Stop()

		for {
			select {
			case <-updateStatsTicker.C:
				g.sampleLiveStats()
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	})

	if g.runStreamManager != nil {
		// Only run stream manager if GrafanaLive properly initialized.
		eGroup.Go(func() error {
			return g.runStreamManager.Run(eCtx)
		})
	}

	return eGroup.Wait()
}

func getCheckOriginFunc(appURL *url.URL, originPatterns []string, originGlobs []glob.Glob) func(r *http.Request) bool {
	return func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		if len(originPatterns) == 1 && originPatterns[0] == "*" {
			// fast path for *.
			return true
		}
		originURL, err := url.Parse(strings.ToLower(origin))
		if err != nil {
			logger.Warn("Failed to parse request origin", "error", err, "origin", origin)
			return false
		}
		if strings.EqualFold(originURL.Host, r.Host) {
			return true
		}
		ok, err := checkAllowedOrigin(origin, originURL, appURL, originGlobs)
		if err != nil {
			logger.Warn("Error parsing request origin", "error", err, "origin", origin)
			return false
		}
		if !ok {
			logger.Warn("Request Origin is not authorized", "origin", origin, "host", r.Host, "appUrl", appURL.String(), "allowedOrigins", strings.Join(originPatterns, ","))
			return false
		}
		return true
	}
}

func checkAllowedOrigin(origin string, originURL *url.URL, appURL *url.URL, originGlobs []glob.Glob) (bool, error) {
	// Try to match over configured [server] root_url first.
	if originURL.Port() == "" {
		if strings.EqualFold(originURL.Scheme, appURL.Scheme) && strings.EqualFold(originURL.Host, appURL.Hostname()) {
			return true, nil
		}
	} else {
		if strings.EqualFold(originURL.Scheme, appURL.Scheme) && strings.EqualFold(originURL.Host, appURL.Host) {
			return true, nil
		}
	}
	// If there is still no match try [live] allowed_origins patterns.
	for _, pattern := range originGlobs {
		if pattern.Match(origin) {
			return true, nil
		}
	}
	return false, nil
}

var clientConcurrency = 12

func (g *GrafanaLive) IsHA() bool {
	return g.Cfg != nil && g.Cfg.LiveHAEngine != ""
}

func runConcurrentlyIfNeeded(ctx context.Context, semaphore chan struct{}, fn func()) error {
	if cap(semaphore) > 1 {
		select {
		case semaphore <- struct{}{}:
		case <-ctx.Done():
			return ctx.Err()
		}
		go func() {
			defer func() { <-semaphore }()
			fn()
		}()
	} else {
		// No need in separate goroutines.
		fn()
	}
	return nil
}

func (g *GrafanaLive) checkIDTokenExpirationAndRefresh(user identity.Requester, client *centrifuge.Client) bool {
	if !identity.IsIDTokenExpired(user) {
		return false
	}

	logger.Debug("ID token expired, triggering refresh", "user", client.UserID(), "client", client.ID())
	err := g.node.Refresh(client.UserID(), centrifuge.WithRefreshExpired(true))
	if err != nil {
		logger.Error("Failed to refresh expired ID token", "user", client.UserID(), "client", client.ID(), "error", err)
	}

	return true
}

func (g *GrafanaLive) HandleDatasourceDelete(orgID int64, dsUID string) {
	if g.runStreamManager == nil {
		return
	}
	err := g.runStreamManager.HandleDatasourceDelete(orgID, dsUID)
	if err != nil {
		logger.Error("Error handling datasource delete", "error", err)
	}
}

func (g *GrafanaLive) HandleDatasourceUpdate(orgID int64, dsUID string) {
	if g.runStreamManager == nil {
		return
	}
	err := g.runStreamManager.HandleDatasourceUpdate(orgID, dsUID)
	if err != nil {
		logger.Error("Error handling datasource update", "error", err)
	}
}

// Use a configuration that's compatible with the standard library
// to minimize the risk of introducing bugs. This will make sure
// that map keys is ordered.
var jsonStd = jsoniter.ConfigCompatibleWithStandardLibrary

func (g *GrafanaLive) handleOnRPC(clientContextWithSpan context.Context, client *centrifuge.Client, e centrifuge.RPCEvent) (centrifuge.RPCReply, error) {
	logger.Debug("Client calls RPC", "user", client.UserID(), "client", client.ID(), "method", e.Method)
	if e.Method != "grafana.query" {
		return centrifuge.RPCReply{}, centrifuge.ErrorMethodNotFound
	}
	user, ok := livecontext.GetContextSignedUser(clientContextWithSpan)
	if !ok {
		logger.Error("No user found in context", "user", client.UserID(), "client", client.ID(), "method", e.Method)
		return centrifuge.RPCReply{}, centrifuge.ErrorInternal
	}

	// Check if ID token is expired and trigger refresh if needed
	if expired := g.checkIDTokenExpirationAndRefresh(user, client); expired {
		return centrifuge.RPCReply{}, centrifuge.ErrorExpired
	}

	var req dtos.MetricRequest
	err := json.Unmarshal(e.Data, &req)
	if err != nil {
		return centrifuge.RPCReply{}, centrifuge.ErrorBadRequest
	}
	resp, err := g.queryDataService.QueryData(clientContextWithSpan, user, false, req)
	if err != nil {
		logger.Error("Error query data", "user", client.UserID(), "client", client.ID(), "method", e.Method, "error", err)
		if errors.Is(err, datasources.ErrDataSourceAccessDenied) {
			return centrifuge.RPCReply{}, &centrifuge.Error{Code: uint32(http.StatusForbidden), Message: http.StatusText(http.StatusForbidden)}
		}
		var gfErr errutil.Error
		if errors.As(err, &gfErr) && gfErr.Reason.Status() == errutil.StatusBadRequest {
			return centrifuge.RPCReply{}, &centrifuge.Error{Code: uint32(http.StatusBadRequest), Message: http.StatusText(http.StatusBadRequest)}
		}
		return centrifuge.RPCReply{}, centrifuge.ErrorInternal
	}
	data, err := jsonStd.Marshal(resp)
	if err != nil {
		logger.Error("Error marshaling query response", "user", client.UserID(), "client", client.ID(), "method", e.Method, "error", err)
		return centrifuge.RPCReply{}, centrifuge.ErrorInternal
	}
	return centrifuge.RPCReply{
		Data: data,
	}, nil
}

func (g *GrafanaLive) handleOnSubscribe(clientContextWithSpan context.Context, client *centrifuge.Client, e centrifuge.SubscribeEvent) (centrifuge.SubscribeReply, error) {
	logger.Debug("Client wants to subscribe", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)

	user, ok := livecontext.GetContextSignedUser(clientContextWithSpan)
	if !ok {
		logger.Error("No user found in context", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
		return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
	}

	// Check if ID token is expired and trigger refresh if needed
	if expired := g.checkIDTokenExpirationAndRefresh(user, client); expired {
		return centrifuge.SubscribeReply{}, centrifuge.ErrorExpired
	}

	// See a detailed comment for StripOrgID about orgID management in Live.
	orgID, channel, err := orgchannel.StripOrgID(e.Channel)
	if err != nil {
		logger.Error("Error parsing channel", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
		return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
	}

	if user.GetOrgID() != orgID {
		logger.Info("Error subscribing: wrong orgId", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
		return centrifuge.SubscribeReply{}, centrifuge.ErrorPermissionDenied
	}

	var reply model.SubscribeReply
	var status backend.SubscribeStreamStatus
	var ruleFound bool

	if g.Pipeline != nil {
		rule, ok, err := g.Pipeline.Get(user.GetOrgID(), channel)
		if err != nil {
			logger.Error("Error getting channel rule", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
			return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
		}
		ruleFound = ok
		if ok {
			if rule.SubscribeAuth != nil {
				ok, err := rule.SubscribeAuth.CanSubscribe(clientContextWithSpan, user)
				if err != nil {
					logger.Error("Error checking subscribe permissions", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
					return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
				}
				if !ok {
					// using HTTP error codes for WS errors too.
					code, text := subscribeStatusToHTTPError(backend.SubscribeStreamStatusPermissionDenied)
					return centrifuge.SubscribeReply{}, &centrifuge.Error{Code: uint32(code), Message: text}
				}
			}
			if len(rule.Subscribers) > 0 {
				var err error
				for _, sub := range rule.Subscribers {
					reply, status, err = sub.Subscribe(clientContextWithSpan, pipeline.Vars{
						OrgID:   orgID,
						Channel: channel,
					}, e.Data)
					if err != nil {
						logger.Error("Error channel rule subscribe", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
						return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
					}
					if status != backend.SubscribeStreamStatusOK {
						break
					}
				}
			}
		}
	}
	if !ruleFound {
		handler, addr, err := g.GetChannelHandler(clientContextWithSpan, user, channel)
		if err != nil {
			if errors.Is(err, live.ErrInvalidChannelID) {
				logger.Info("Invalid channel ID", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
				return centrifuge.SubscribeReply{}, &centrifuge.Error{Code: uint32(http.StatusBadRequest), Message: "invalid channel ID"}
			}
			logger.Error("Error getting channel handler", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
			return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
		}
		reply, status, err = handler.OnSubscribe(clientContextWithSpan, user, model.SubscribeEvent{
			Channel: channel,
			Path:    addr.Path,
			Data:    e.Data,
		})
		if err != nil {
			logger.Error("Error calling channel handler subscribe", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
			return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
		}
	}
	if status != backend.SubscribeStreamStatusOK {
		// using HTTP error codes for WS errors too.
		code, text := subscribeStatusToHTTPError(status)
		logger.Debug("Return custom subscribe error", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "code", code)
		return centrifuge.SubscribeReply{}, &centrifuge.Error{Code: uint32(code), Message: text}
	}
	logger.Debug("Client subscribed", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
	return centrifuge.SubscribeReply{
		Options: centrifuge.SubscribeOptions{
			EmitPresence:   reply.Presence,
			EmitJoinLeave:  reply.JoinLeave,
			PushJoinLeave:  reply.JoinLeave,
			EnableRecovery: reply.Recover,
			Data:           reply.Data,
		},
	}, nil
}

func (g *GrafanaLive) handleOnPublish(clientCtxWithSpan context.Context, client *centrifuge.Client, e centrifuge.PublishEvent) (centrifuge.PublishReply, error) {
	logger.Debug("Client wants to publish", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)

	user, ok := livecontext.GetContextSignedUser(clientCtxWithSpan)
	if !ok {
		logger.Error("No user found in context", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
		return centrifuge.PublishReply{}, centrifuge.ErrorInternal
	}

	// Check if ID token is expired and trigger refresh if needed
	if expired := g.checkIDTokenExpirationAndRefresh(user, client); expired {
		return centrifuge.PublishReply{}, centrifuge.ErrorExpired
	}

	// See a detailed comment for StripOrgID about orgID management in Live.
	orgID, channel, err := orgchannel.StripOrgID(e.Channel)
	if err != nil {
		logger.Error("Error parsing channel", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
		return centrifuge.PublishReply{}, centrifuge.ErrorInternal
	}

	if user.GetOrgID() != orgID {
		logger.Info("Error subscribing: wrong orgId", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
		return centrifuge.PublishReply{}, centrifuge.ErrorPermissionDenied
	}

	if g.Pipeline != nil {
		rule, ok, err := g.Pipeline.Get(user.GetOrgID(), channel)
		if err != nil {
			logger.Error("Error getting channel rule", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
			return centrifuge.PublishReply{}, centrifuge.ErrorInternal
		}
		if ok {
			if rule.PublishAuth != nil {
				ok, err := rule.PublishAuth.CanPublish(clientCtxWithSpan, user)
				if err != nil {
					logger.Error("Error checking publish permissions", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
					return centrifuge.PublishReply{}, centrifuge.ErrorInternal
				}
				if !ok {
					// using HTTP error codes for WS errors too.
					code, text := publishStatusToHTTPError(backend.PublishStreamStatusPermissionDenied)
					return centrifuge.PublishReply{}, &centrifuge.Error{Code: uint32(code), Message: text}
				}
			} else {
				if !user.HasRole(org.RoleAdmin) {
					// using HTTP error codes for WS errors too.
					code, text := publishStatusToHTTPError(backend.PublishStreamStatusPermissionDenied)
					return centrifuge.PublishReply{}, &centrifuge.Error{Code: uint32(code), Message: text}
				}
			}
			_, err := g.Pipeline.ProcessInput(clientCtxWithSpan, user.GetOrgID(), channel, e.Data)
			if err != nil {
				logger.Error("Error processing input", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
				return centrifuge.PublishReply{}, centrifuge.ErrorInternal
			}
			return centrifuge.PublishReply{
				Result: &centrifuge.PublishResult{},
			}, nil
		}
	}

	handler, addr, err := g.GetChannelHandler(clientCtxWithSpan, user, channel)
	if err != nil {
		if errors.Is(err, live.ErrInvalidChannelID) {
			logger.Info("Invalid channel ID", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
			return centrifuge.PublishReply{}, &centrifuge.Error{Code: uint32(http.StatusBadRequest), Message: "invalid channel ID"}
		}
		logger.Error("Error getting channel handler", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
		return centrifuge.PublishReply{}, centrifuge.ErrorInternal
	}
	reply, status, err := handler.OnPublish(client.Context(), user, model.PublishEvent{
		Channel: channel,
		Path:    addr.Path,
		Data:    e.Data,
	})
	if err != nil {
		logger.Error("Error calling channel handler publish", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
		return centrifuge.PublishReply{}, centrifuge.ErrorInternal
	}

	if status != backend.PublishStreamStatusOK {
		// using HTTP error codes for WS errors too.
		code, text := publishStatusToHTTPError(status)
		logger.Debug("Return custom publish error", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "code", code)
		return centrifuge.PublishReply{}, &centrifuge.Error{Code: uint32(code), Message: text}
	}
	centrifugeReply := centrifuge.PublishReply{
		Options: centrifuge.PublishOptions{
			HistorySize: reply.HistorySize,
			HistoryTTL:  reply.HistoryTTL,
		},
	}
	if reply.Data != nil {
		// If data is not nil then we published it manually and tell Centrifuge
		// publication result so Centrifuge won't publish itself.
		result, err := g.node.Publish(e.Channel, reply.Data)
		if err != nil {
			logger.Error("Error publishing", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err, "data", string(reply.Data))
			return centrifuge.PublishReply{}, centrifuge.ErrorInternal
		}
		centrifugeReply.Result = &result
	}
	logger.Debug("Publication successful", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
	return centrifugeReply, nil
}

func subscribeStatusToHTTPError(status backend.SubscribeStreamStatus) (int, string) {
	switch status {
	case backend.SubscribeStreamStatusNotFound:
		return http.StatusNotFound, http.StatusText(http.StatusNotFound)
	case backend.SubscribeStreamStatusPermissionDenied:
		return http.StatusForbidden, http.StatusText(http.StatusForbidden)
	default:
		logger.Warn("Unknown subscribe status", "status", status)
		return http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError)
	}
}

func publishStatusToHTTPError(status backend.PublishStreamStatus) (int, string) {
	switch status {
	case backend.PublishStreamStatusNotFound:
		return http.StatusNotFound, http.StatusText(http.StatusNotFound)
	case backend.PublishStreamStatusPermissionDenied:
		return http.StatusForbidden, http.StatusText(http.StatusForbidden)
	default:
		logger.Warn("Unknown publish status", "status", status)
		return http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError)
	}
}

// GetChannelHandler gives thread-safe access to the channel.
func (g *GrafanaLive) GetChannelHandler(ctx context.Context, user identity.Requester, channel string) (model.ChannelHandler, live.Channel, error) {
	// Parse the identifier ${scope}/${namespace}/${path}
	addr, err := live.ParseChannel(channel)
	if err != nil {
		return nil, live.Channel{}, err
	}

	g.channelsMu.RLock()
	c, ok := g.channels[channel]
	g.channelsMu.RUnlock() // defer? but then you can't lock further down
	if ok {
		logger.Debug("Found cached channel handler", "channel", channel)
		return c, addr, nil
	}

	g.channelsMu.Lock()
	defer g.channelsMu.Unlock()
	c, ok = g.channels[channel] // may have filled in while locked
	if ok {
		logger.Debug("Found cached channel handler", "channel", channel)
		return c, addr, nil
	}

	getter, err := g.GetChannelHandlerFactory(ctx, user, addr.Scope, addr.Namespace)
	if err != nil {
		return nil, addr, fmt.Errorf("error getting channel handler factory: %w", err)
	}

	// First access will initialize.
	c, err = getter.GetHandlerForPath(addr.Path)
	if err != nil {
		return nil, addr, fmt.Errorf("error getting handler for path: %w", err)
	}

	logger.Info("Initialized channel handler", "channel", channel, "address", addr)
	g.channels[channel] = c
	return c, addr, nil
}

// GetChannelHandlerFactory gets a ChannelHandlerFactory for a namespace.
// It gives thread-safe access to the channel.
func (g *GrafanaLive) GetChannelHandlerFactory(ctx context.Context, user identity.Requester, scope string, namespace string) (model.ChannelHandlerFactory, error) {
	switch scope {
	case live.ScopeGrafana:
		return g.handleGrafanaScope(user, namespace)
	case live.ScopeWatch:
		return g.handleWatchScope()
	case live.ScopePlugin:
		return g.handlePluginScope(ctx, user, namespace)
	case live.ScopeDatasource:
		return g.handleDatasourceScope(ctx, user, namespace)
	case live.ScopeStream:
		return g.handleStreamScope(user, namespace)
	default:
		return nil, fmt.Errorf("invalid scope: %q", scope)
	}
}

func (g *GrafanaLive) handleGrafanaScope(_ identity.Requester, namespace string) (model.ChannelHandlerFactory, error) {
	if p, ok := g.GrafanaScope.Features[namespace]; ok {
		return p, nil
	}
	return nil, fmt.Errorf("unknown feature: %q", namespace)
}

func (g *GrafanaLive) handleWatchScope() (model.ChannelHandlerFactory, error) {
	if p, ok := g.GrafanaScope.Features["watch"]; ok {
		return p, nil
	}
	return nil, fmt.Errorf("watch not registered")
}

func (g *GrafanaLive) handlePluginScope(ctx context.Context, _ identity.Requester, namespace string) (model.ChannelHandlerFactory, error) {
	streamHandler, err := g.getStreamPlugin(ctx, namespace)
	if err != nil {
		return nil, fmt.Errorf("can't find stream plugin: %s", namespace)
	}
	return features.NewPluginRunner(
		namespace,
		"", // No instance uid for non-datasource plugins.
		g.runStreamManager,
		g.contextGetter,
		streamHandler,
	), nil
}

func (g *GrafanaLive) handleStreamScope(u identity.Requester, namespace string) (model.ChannelHandlerFactory, error) {
	return g.ManagedStreamRunner.GetOrCreateStream(u.GetOrgID(), live.ScopeStream, namespace)
}

func (g *GrafanaLive) handleDatasourceScope(ctx context.Context, user identity.Requester, namespace string) (model.ChannelHandlerFactory, error) {
	ds, err := g.DataSourceCache.GetDatasourceByUID(ctx, namespace, user, false)
	if err != nil {
		return nil, fmt.Errorf("error getting datasource: %w", err)
	}
	streamHandler, err := g.getStreamPlugin(ctx, ds.Type)
	if err != nil {
		return nil, fmt.Errorf("can't find stream plugin: %s", ds.Type)
	}
	return features.NewPluginRunner(
		ds.Type,
		ds.UID,
		g.runStreamManager,
		g.contextGetter,
		streamHandler,
	), nil
}

// Publish sends the data to the channel without checking permissions etc.
func (g *GrafanaLive) Publish(orgID int64, channel string, data []byte) error {
	_, err := g.node.Publish(orgchannel.PrependOrgID(orgID, channel), data)
	return err
}

// ClientCount returns the number of clients.
func (g *GrafanaLive) ClientCount(orgID int64, channel string) (int, error) {
	p, err := g.node.Presence(orgchannel.PrependOrgID(orgID, channel))
	if err != nil {
		return 0, err
	}
	return len(p.Presence), nil
}

func (g *GrafanaLive) HandleHTTPPublish(ctx *contextmodel.ReqContext) response.Response {
	cmd := dtos.LivePublishCmd{}
	if err := web.Bind(ctx.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	addr, err := live.ParseChannel(cmd.Channel)
	if err != nil {
		return response.Error(http.StatusBadRequest, "invalid channel ID", nil)
	}

	logger.Debug("Publish API cmd", "identity", ctx.GetID(), "channel", cmd.Channel)
	user := ctx.SignedInUser
	channel := cmd.Channel

	if g.Pipeline != nil {
		rule, ok, err := g.Pipeline.Get(user.GetOrgID(), channel)
		if err != nil {
			logger.Error("Error getting channel rule", "user", user, "channel", channel, "error", err)
			return response.Error(http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError), nil)
		}
		if ok {
			if rule.PublishAuth != nil {
				ok, err := rule.PublishAuth.CanPublish(ctx.Req.Context(), user)
				if err != nil {
					logger.Error("Error checking publish permissions", "user", user, "channel", channel, "error", err)
					return response.Error(http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError), nil)
				}
				if !ok {
					return response.Error(http.StatusForbidden, http.StatusText(http.StatusForbidden), nil)
				}
			} else {
				if !user.HasRole(org.RoleAdmin) {
					return response.Error(http.StatusForbidden, http.StatusText(http.StatusForbidden), nil)
				}
			}
			_, err := g.Pipeline.ProcessInput(ctx.Req.Context(), user.GetOrgID(), channel, cmd.Data)
			if err != nil {
				logger.Error("Error processing input", "user", user, "channel", channel, "error", err)
				return response.Error(http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError), nil)
			}
			return response.JSON(http.StatusOK, dtos.LivePublishResponse{})
		}
	}

	channelHandler, addr, err := g.GetChannelHandler(ctx.Req.Context(), ctx.SignedInUser, cmd.Channel)
	if err != nil {
		logger.Error("Error getting channels handler", "error", err, "channel", cmd.Channel)
		return response.Error(http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError), nil)
	}

	reply, status, err := channelHandler.OnPublish(ctx.Req.Context(), ctx.SignedInUser, model.PublishEvent{Channel: cmd.Channel, Path: addr.Path, Data: cmd.Data})
	if err != nil {
		logger.Error("Error calling OnPublish", "error", err, "channel", cmd.Channel)
		return response.Error(http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError), nil)
	}

	if status != backend.PublishStreamStatusOK {
		code, text := publishStatusToHTTPError(status)
		return response.Error(code, text, nil)
	}
	if reply.Data != nil {
		err = g.Publish(ctx.GetOrgID(), cmd.Channel, cmd.Data)
		if err != nil {
			logger.Error("Error publish to channel", "error", err, "channel", cmd.Channel)
			return response.Error(http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError), nil)
		}
	}
	logger.Debug("Publication successful", "identity", ctx.GetID(), "channel", cmd.Channel)
	return response.JSON(http.StatusOK, dtos.LivePublishResponse{})
}

type streamChannelListResponse struct {
	Channels []*managedstream.ManagedChannel `json:"channels"`
}

// HandleListHTTP returns metadata so the UI can build a nice form
func (g *GrafanaLive) HandleListHTTP(c *contextmodel.ReqContext) response.Response {
	var channels []*managedstream.ManagedChannel
	var err error
	if g.IsHA() {
		channels, err = g.surveyCaller.CallManagedStreams(c.GetOrgID())
	} else {
		channels, err = g.ManagedStreamRunner.GetManagedChannels(c.GetOrgID())
	}
	if err != nil {
		return response.Error(http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError), err)
	}
	info := streamChannelListResponse{
		Channels: channels,
	}
	return response.JSONStreaming(http.StatusOK, info)
}

// HandleInfoHTTP special http response for
func (g *GrafanaLive) HandleInfoHTTP(ctx *contextmodel.ReqContext) response.Response {
	path := web.Params(ctx.Req)["*"]
	if path == "grafana/dashboards/gitops" {
		return response.JSON(http.StatusOK, util.DynMap{
			"active": g.GrafanaScope.Dashboards.HasGitOpsObserver(ctx.GetOrgID()),
		})
	}
	return response.JSONStreaming(http.StatusNotFound, util.DynMap{
		"message": "Info is not supported for this channel",
	})
}

// HandleChannelRulesListHTTP ...
func (g *GrafanaLive) HandleChannelRulesListHTTP(c *contextmodel.ReqContext) response.Response {
	result, err := g.pipelineStorage.ListChannelRules(c.Req.Context(), c.GetOrgID())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get channel rules", err)
	}
	return response.JSON(http.StatusOK, util.DynMap{
		"rules": result,
	})
}

type ConvertDryRunRequest struct {
	ChannelRules []pipeline.ChannelRule `json:"channelRules"`
	Channel      string                 `json:"channel"`
	Data         string                 `json:"data"`
}

type ConvertDryRunResponse struct {
	ChannelFrames []*pipeline.ChannelFrame `json:"channelFrames"`
}

type DryRunRuleStorage struct {
	ChannelRules []pipeline.ChannelRule
}

func (s *DryRunRuleStorage) GetWriteConfig(_ context.Context, _ int64, _ pipeline.WriteConfigGetCmd) (pipeline.WriteConfig, bool, error) {
	return pipeline.WriteConfig{}, false, errors.New("not implemented by dry run rule storage")
}

func (s *DryRunRuleStorage) CreateWriteConfig(_ context.Context, _ int64, _ pipeline.WriteConfigCreateCmd) (pipeline.WriteConfig, error) {
	return pipeline.WriteConfig{}, errors.New("not implemented by dry run rule storage")
}

func (s *DryRunRuleStorage) UpdateWriteConfig(_ context.Context, _ int64, _ pipeline.WriteConfigUpdateCmd) (pipeline.WriteConfig, error) {
	return pipeline.WriteConfig{}, errors.New("not implemented by dry run rule storage")
}

func (s *DryRunRuleStorage) DeleteWriteConfig(_ context.Context, _ int64, _ pipeline.WriteConfigDeleteCmd) error {
	return errors.New("not implemented by dry run rule storage")
}

func (s *DryRunRuleStorage) CreateChannelRule(_ context.Context, _ int64, _ pipeline.ChannelRuleCreateCmd) (pipeline.ChannelRule, error) {
	return pipeline.ChannelRule{}, errors.New("not implemented by dry run rule storage")
}

func (s *DryRunRuleStorage) UpdateChannelRule(_ context.Context, _ int64, _ pipeline.ChannelRuleUpdateCmd) (pipeline.ChannelRule, error) {
	return pipeline.ChannelRule{}, errors.New("not implemented by dry run rule storage")
}

func (s *DryRunRuleStorage) DeleteChannelRule(_ context.Context, _ int64, _ pipeline.ChannelRuleDeleteCmd) error {
	return errors.New("not implemented by dry run rule storage")
}

func (s *DryRunRuleStorage) ListWriteConfigs(_ context.Context, _ int64) ([]pipeline.WriteConfig, error) {
	return nil, nil
}

func (s *DryRunRuleStorage) ListChannelRules(_ context.Context, _ int64) ([]pipeline.ChannelRule, error) {
	return s.ChannelRules, nil
}

// HandlePipelineConvertTestHTTP ...
func (g *GrafanaLive) HandlePipelineConvertTestHTTP(c *contextmodel.ReqContext) response.Response {
	body, err := io.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error reading body", err)
	}
	var req ConvertDryRunRequest
	err = json.Unmarshal(body, &req)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Error decoding request", err)
	}
	storage := &DryRunRuleStorage{
		ChannelRules: req.ChannelRules,
	}
	builder := &pipeline.StorageRuleBuilder{
		Node:                 g.node,
		ManagedStream:        g.ManagedStreamRunner,
		FrameStorage:         pipeline.NewFrameStorage(),
		Storage:              storage,
		ChannelHandlerGetter: g,
	}
	channelRuleGetter := pipeline.NewCacheSegmentedTree(builder)
	pipe, err := pipeline.New(channelRuleGetter)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error creating pipeline", err)
	}
	rule, ok, err := channelRuleGetter.Get(c.GetOrgID(), req.Channel)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error getting channel rule", err)
	}
	if !ok {
		return response.Error(http.StatusNotFound, "No rule found", nil)
	}
	if rule.Converter == nil {
		return response.Error(http.StatusNotFound, "No converter found", nil)
	}
	channelFrames, err := pipe.DataToChannelFrames(c.Req.Context(), *rule, c.GetOrgID(), req.Channel, []byte(req.Data))
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error converting data", err)
	}
	return response.JSON(http.StatusOK, ConvertDryRunResponse{
		ChannelFrames: channelFrames,
	})
}

// HandleChannelRulesPostHTTP ...
func (g *GrafanaLive) HandleChannelRulesPostHTTP(c *contextmodel.ReqContext) response.Response {
	body, err := io.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error reading body", err)
	}
	var cmd pipeline.ChannelRuleCreateCmd
	err = json.Unmarshal(body, &cmd)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Error decoding channel rule", err)
	}
	rule, err := g.pipelineStorage.CreateChannelRule(c.Req.Context(), c.GetOrgID(), cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to create channel rule", err)
	}
	return response.JSON(http.StatusOK, util.DynMap{
		"rule": rule,
	})
}

// HandleChannelRulesPutHTTP ...
func (g *GrafanaLive) HandleChannelRulesPutHTTP(c *contextmodel.ReqContext) response.Response {
	body, err := io.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error reading body", err)
	}
	var cmd pipeline.ChannelRuleUpdateCmd
	err = json.Unmarshal(body, &cmd)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Error decoding channel rule", err)
	}
	if cmd.Pattern == "" {
		return response.Error(http.StatusBadRequest, "Rule pattern required", nil)
	}
	rule, err := g.pipelineStorage.UpdateChannelRule(c.Req.Context(), c.GetOrgID(), cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update channel rule", err)
	}
	return response.JSON(http.StatusOK, util.DynMap{
		"rule": rule,
	})
}

// HandleChannelRulesDeleteHTTP ...
func (g *GrafanaLive) HandleChannelRulesDeleteHTTP(c *contextmodel.ReqContext) response.Response {
	body, err := io.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error reading body", err)
	}
	var cmd pipeline.ChannelRuleDeleteCmd
	err = json.Unmarshal(body, &cmd)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Error decoding channel rule", err)
	}
	if cmd.Pattern == "" {
		return response.Error(http.StatusBadRequest, "Rule pattern required", nil)
	}
	err = g.pipelineStorage.DeleteChannelRule(c.Req.Context(), c.GetOrgID(), cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to delete channel rule", err)
	}
	return response.JSON(http.StatusOK, util.DynMap{})
}

// HandlePipelineEntitiesListHTTP ...
func (g *GrafanaLive) HandlePipelineEntitiesListHTTP(_ *contextmodel.ReqContext) response.Response {
	return response.JSON(http.StatusOK, util.DynMap{
		"subscribers":     pipeline.SubscribersRegistry,
		"dataOutputs":     pipeline.DataOutputsRegistry,
		"converters":      pipeline.ConvertersRegistry,
		"frameProcessors": pipeline.FrameProcessorsRegistry,
		"frameOutputs":    pipeline.FrameOutputsRegistry,
	})
}

// HandleWriteConfigsListHTTP ...
func (g *GrafanaLive) HandleWriteConfigsListHTTP(c *contextmodel.ReqContext) response.Response {
	backends, err := g.pipelineStorage.ListWriteConfigs(c.Req.Context(), c.GetOrgID())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get write configs", err)
	}
	result := make([]pipeline.WriteConfigDto, 0, len(backends))
	for _, b := range backends {
		result = append(result, pipeline.WriteConfigToDto(b))
	}
	return response.JSON(http.StatusOK, util.DynMap{
		"writeConfigs": result,
	})
}

// HandleWriteConfigsPostHTTP ...
func (g *GrafanaLive) HandleWriteConfigsPostHTTP(c *contextmodel.ReqContext) response.Response {
	body, err := io.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error reading body", err)
	}
	var cmd pipeline.WriteConfigCreateCmd
	err = json.Unmarshal(body, &cmd)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Error decoding write config create command", err)
	}
	result, err := g.pipelineStorage.CreateWriteConfig(c.Req.Context(), c.GetOrgID(), cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to create write config", err)
	}
	return response.JSON(http.StatusOK, util.DynMap{
		"writeConfig": pipeline.WriteConfigToDto(result),
	})
}

// HandleWriteConfigsPutHTTP ...
func (g *GrafanaLive) HandleWriteConfigsPutHTTP(c *contextmodel.ReqContext) response.Response {
	body, err := io.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error reading body", err)
	}
	var cmd pipeline.WriteConfigUpdateCmd
	err = json.Unmarshal(body, &cmd)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Error decoding write config update command", err)
	}
	if cmd.UID == "" {
		return response.Error(http.StatusBadRequest, "UID required", nil)
	}
	existingBackend, ok, err := g.pipelineStorage.GetWriteConfig(c.Req.Context(), c.GetOrgID(), pipeline.WriteConfigGetCmd{
		UID: cmd.UID,
	})
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get write config", err)
	}
	if ok {
		if cmd.SecureSettings == nil {
			cmd.SecureSettings = map[string]string{}
		}
		secureJSONData, err := g.SecretsService.DecryptJsonData(c.Req.Context(), existingBackend.SecureSettings)
		if err != nil {
			logger.Error("Error decrypting secure settings", "error", err)
			return response.Error(http.StatusInternalServerError, "Error decrypting secure settings", err)
		}
		for k, v := range secureJSONData {
			if _, ok := cmd.SecureSettings[k]; !ok {
				cmd.SecureSettings[k] = v
			}
		}
	}
	result, err := g.pipelineStorage.UpdateWriteConfig(c.Req.Context(), c.GetOrgID(), cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update write config", err)
	}
	return response.JSON(http.StatusOK, util.DynMap{
		"writeConfig": pipeline.WriteConfigToDto(result),
	})
}

// HandleWriteConfigsDeleteHTTP ...
func (g *GrafanaLive) HandleWriteConfigsDeleteHTTP(c *contextmodel.ReqContext) response.Response {
	body, err := io.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error reading body", err)
	}
	var cmd pipeline.WriteConfigDeleteCmd
	err = json.Unmarshal(body, &cmd)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Error decoding write config delete command", err)
	}
	if cmd.UID == "" {
		return response.Error(http.StatusBadRequest, "UID required", nil)
	}
	err = g.pipelineStorage.DeleteWriteConfig(c.Req.Context(), c.GetOrgID(), cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to delete write config", err)
	}
	return response.JSON(http.StatusOK, util.DynMap{})
}

// Write to the standard log15 logger
func handleLog(msg centrifuge.LogEntry) {
	arr := make([]interface{}, 0)
	for k, v := range msg.Fields {
		switch v {
		case nil:
			v = "<nil>"
		case "":
			v = "<empty>"
		}
		arr = append(arr, k, v)
	}

	switch msg.Level {
	case centrifuge.LogLevelDebug:
		loggerCF.Debug(msg.Message, arr...)
	case centrifuge.LogLevelError:
		loggerCF.Error(msg.Message, arr...)
	case centrifuge.LogLevelInfo:
		loggerCF.Info(msg.Message, arr...)
	default:
		loggerCF.Debug(msg.Message, arr...)
	}
}

func (g *GrafanaLive) sampleLiveStats() {
	numClients := g.node.Hub().NumClients()
	numUsers := g.node.Hub().NumUsers()
	numChannels := g.node.Hub().NumChannels()
	var numNodes int
	if info, err := g.node.Info(); err == nil {
		numNodes = len(info.Nodes)
	}

	g.usageStats.sampleCount++
	g.usageStats.numClientsSum += numClients
	g.usageStats.numUsersSum += numUsers

	if numClients > g.usageStats.numClientsMax {
		g.usageStats.numClientsMax = numClients
	}

	if numUsers > g.usageStats.numUsersMax {
		g.usageStats.numUsersMax = numUsers
	}

	if numNodes > g.usageStats.numNodesMax {
		g.usageStats.numNodesMax = numNodes
	}

	if numChannels > g.usageStats.numChannelsMax {
		g.usageStats.numChannelsMax = numChannels
	}
}

func (g *GrafanaLive) resetLiveStats() {
	g.usageStats = usageStats{}
}

func getHistogramMetric(val int, bounds []int, metricPrefix string) string {
	for _, bound := range bounds {
		if val <= bound {
			return metricPrefix + "le_" + strconv.Itoa(bound)
		}
	}
	return metricPrefix + "le_inf"
}

func (g *GrafanaLive) collectLiveStats(_ context.Context) (map[string]interface{}, error) {
	liveUsersAvg := 0
	liveClientsAvg := 0

	if g.usageStats.sampleCount > 0 {
		liveUsersAvg = g.usageStats.numUsersSum / g.usageStats.sampleCount
		liveClientsAvg = g.usageStats.numClientsSum / g.usageStats.sampleCount
	}

	var liveEnabled int
	if g.Cfg.LiveMaxConnections != 0 {
		liveEnabled = 1
	}

	var liveHAEnabled int
	if g.Cfg.LiveHAEngine != "" {
		liveHAEnabled = 1
	}

	metrics := map[string]interface{}{
		"stats.live_enabled.count":      liveEnabled,
		"stats.live_ha_enabled.count":   liveHAEnabled,
		"stats.live_samples.count":      g.usageStats.sampleCount,
		"stats.live_users_max.count":    g.usageStats.numUsersMax,
		"stats.live_users_avg.count":    liveUsersAvg,
		"stats.live_clients_max.count":  g.usageStats.numClientsMax,
		"stats.live_clients_avg.count":  liveClientsAvg,
		"stats.live_channels_max.count": g.usageStats.numChannelsMax,
		"stats.live_nodes_max.count":    g.usageStats.numNodesMax,
	}

	metrics[getHistogramMetric(g.usageStats.numClientsMax, []int{0, 10, 100, 1000, 10000, 100000}, "stats.live_clients_")] = 1
	metrics[getHistogramMetric(g.usageStats.numUsersMax, []int{0, 10, 100, 1000, 10000, 100000}, "stats.live_users_")] = 1
	metrics[getHistogramMetric(g.usageStats.numChannelsMax, []int{0, 10, 100, 1000, 10000, 100000}, "stats.live_channels_")] = 1
	metrics[getHistogramMetric(g.usageStats.numNodesMax, []int{1, 3, 9}, "stats.live_nodes_")] = 1

	return metrics, nil
}

func (g *GrafanaLive) registerUsageMetrics() {
	g.usageStatsService.RegisterSendReportCallback(g.resetLiveStats)
	g.usageStatsService.RegisterMetricsFunc(g.collectLiveStats)
}

type usageStats struct {
	numClientsMax  int
	numClientsSum  int
	numUsersMax    int
	numUsersSum    int
	sampleCount    int
	numNodesMax    int
	numChannelsMax int
}
