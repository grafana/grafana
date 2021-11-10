package live

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/services/encryption"

	"github.com/centrifugal/centrifuge"
	"github.com/go-redis/redis/v8"
	"github.com/gobwas/glob"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/live"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/plugincontext"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/live/database"
	"github.com/grafana/grafana/pkg/services/live/features"
	"github.com/grafana/grafana/pkg/services/live/livecontext"
	"github.com/grafana/grafana/pkg/services/live/liveplugin"
	"github.com/grafana/grafana/pkg/services/live/managedstream"
	"github.com/grafana/grafana/pkg/services/live/orgchannel"
	"github.com/grafana/grafana/pkg/services/live/pipeline"
	"github.com/grafana/grafana/pkg/services/live/pushws"
	"github.com/grafana/grafana/pkg/services/live/runstream"
	"github.com/grafana/grafana/pkg/services/live/survey"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
	"golang.org/x/sync/errgroup"
)

var (
	logger   = log.New("live")
	loggerCF = log.New("live.centrifuge")
)

// CoreGrafanaScope list of core features
type CoreGrafanaScope struct {
	Features map[string]models.ChannelHandlerFactory

	// The generic service to advertise dashboard changes
	Dashboards models.DashboardActivityChannel
}

func ProvideService(plugCtxProvider *plugincontext.Provider, cfg *setting.Cfg, routeRegister routing.RouteRegister,
	logsService *cloudwatch.LogsService, pluginStore plugins.Store, cacheService *localcache.CacheService,
	dataSourceCache datasources.CacheService, sqlStore *sqlstore.SQLStore, encService encryption.Service,
	usageStatsService usagestats.Service) (*GrafanaLive, error) {
	g := &GrafanaLive{
		Cfg:                   cfg,
		PluginContextProvider: plugCtxProvider,
		RouteRegister:         routeRegister,
		LogsService:           logsService,
		pluginStore:           pluginStore,
		CacheService:          cacheService,
		DataSourceCache:       dataSourceCache,
		SQLStore:              sqlStore,
		EncryptionService:     encService,
		channels:              make(map[string]models.ChannelHandler),
		GrafanaScope: CoreGrafanaScope{
			Features: make(map[string]models.ChannelHandlerFactory),
		},
		usageStatsService: usageStatsService,
	}

	logger.Debug("GrafanaLive initialization", "ha", g.IsHA())

	// We use default config here as starting point. Default config contains
	// reasonable values for available options.
	scfg := centrifuge.DefaultConfig

	// scfg.LogLevel = centrifuge.LogLevelDebug
	scfg.LogHandler = handleLog
	scfg.LogLevel = centrifuge.LogLevelError
	scfg.MetricsNamespace = "grafana_live"

	// Node is the core object in Centrifuge library responsible for many useful
	// things. For example Node allows to publish messages to channels from server
	// side with its Publish method.
	node, err := centrifuge.New(scfg)
	if err != nil {
		return nil, err
	}
	g.node = node

	if g.IsHA() {
		// Configure HA with Redis. In this case Centrifuge nodes
		// will be connected over Redis PUB/SUB. Presence will work
		// globally since kept inside Redis.
		redisAddress := g.Cfg.LiveHAEngineAddress
		redisShardConfigs := []centrifuge.RedisShardConfig{
			{Address: redisAddress},
		}
		var redisShards []*centrifuge.RedisShard
		for _, redisConf := range redisShardConfigs {
			redisShard, err := centrifuge.NewRedisShard(node, redisConf)
			if err != nil {
				return nil, fmt.Errorf("error connecting to Live Redis: %v", err)
			}
			redisShards = append(redisShards, redisShard)
		}

		broker, err := centrifuge.NewRedisBroker(node, centrifuge.RedisBrokerConfig{
			Prefix: "gf_live",

			// Use reasonably large expiration interval for stream meta key,
			// much bigger than maximum HistoryLifetime value in Node config.
			// This way stream meta data will expire, in some cases you may want
			// to prevent its expiration setting this to zero value.
			HistoryMetaTTL: 7 * 24 * time.Hour,

			// And configure a couple of shards to use.
			Shards: redisShards,
		})
		if err != nil {
			return nil, fmt.Errorf("error creating Live Redis broker: %v", err)
		}
		node.SetBroker(broker)

		presenceManager, err := centrifuge.NewRedisPresenceManager(node, centrifuge.RedisPresenceManagerConfig{
			Prefix: "gf_live",
			Shards: redisShards,
		})
		if err != nil {
			return nil, fmt.Errorf("error creating Live Redis presence manager: %v", err)
		}
		node.SetPresenceManager(presenceManager)
	}

	channelLocalPublisher := liveplugin.NewChannelLocalPublisher(node, nil)

	var managedStreamRunner *managedstream.Runner
	if g.IsHA() {
		redisClient := redis.NewClient(&redis.Options{
			Addr: g.Cfg.LiveHAEngineAddress,
		})
		cmd := redisClient.Ping(context.TODO())
		if _, err := cmd.Result(); err != nil {
			return nil, fmt.Errorf("error pinging Redis: %v", err)
		}
		managedStreamRunner = managedstream.NewRunner(
			g.Publish,
			channelLocalPublisher,
			managedstream.NewRedisFrameCache(redisClient),
		)
	} else {
		managedStreamRunner = managedstream.NewRunner(
			g.Publish,
			channelLocalPublisher,
			managedstream.NewMemoryFrameCache(),
		)
	}

	g.ManagedStreamRunner = managedStreamRunner
	if enabled := g.Cfg.FeatureToggles["live-pipeline"]; enabled {
		var builder pipeline.RuleBuilder
		if os.Getenv("GF_LIVE_DEV_BUILDER") != "" {
			builder = &pipeline.DevRuleBuilder{
				Node:                 node,
				ManagedStream:        g.ManagedStreamRunner,
				FrameStorage:         pipeline.NewFrameStorage(),
				ChannelHandlerGetter: g,
			}
		} else {
			storage := &pipeline.FileStorage{
				DataPath:          cfg.DataPath,
				EncryptionService: g.EncryptionService,
			}
			g.pipelineStorage = storage
			builder = &pipeline.StorageRuleBuilder{
				Node:                 node,
				ManagedStream:        g.ManagedStreamRunner,
				FrameStorage:         pipeline.NewFrameStorage(),
				Storage:              storage,
				ChannelHandlerGetter: g,
				EncryptionService:    g.EncryptionService,
			}
		}
		channelRuleGetter := pipeline.NewCacheSegmentedTree(builder)

		// Pre-build/validate channel rules for all organizations on start.
		// This can be unreasonable to have in production scenario with many
		// organizations.
		query := &models.SearchOrgsQuery{}
		err := sqlstore.SearchOrgs(context.TODO(), query)
		if err != nil {
			return nil, fmt.Errorf("can't get org list: %w", err)
		}
		for _, org := range query.Result {
			_, _, err := channelRuleGetter.Get(org.Id, "")
			if err != nil {
				return nil, fmt.Errorf("error building channel rules for org %d: %w", org.Id, err)
			}
		}

		g.Pipeline, err = pipeline.New(channelRuleGetter)
		if err != nil {
			return nil, err
		}
	}

	g.contextGetter = liveplugin.NewContextGetter(g.PluginContextProvider)
	pipelinedChannelLocalPublisher := liveplugin.NewChannelLocalPublisher(node, g.Pipeline)
	numLocalSubscribersGetter := liveplugin.NewNumLocalSubscribersGetter(node)
	g.runStreamManager = runstream.NewManager(pipelinedChannelLocalPublisher, numLocalSubscribersGetter, g.contextGetter)

	// Initialize the main features
	dash := &features.DashboardHandler{
		Publisher:   g.Publish,
		ClientCount: g.ClientCount,
	}
	g.storage = database.NewStorage(g.SQLStore, g.CacheService)
	g.GrafanaScope.Dashboards = dash
	g.GrafanaScope.Features["dashboard"] = dash
	g.GrafanaScope.Features["broadcast"] = features.NewBroadcastRunner(g.storage)

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
		numConnections := g.node.Hub().NumClients()
		if g.Cfg.LiveMaxConnections >= 0 && numConnections > g.Cfg.LiveMaxConnections {
			logger.Warn(
				"Max number of Live connections reached, increase max_connections in [live] configuration section",
				"user", client.UserID(), "client", client.ID(), "limit", g.Cfg.LiveMaxConnections,
			)
			client.Disconnect(centrifuge.DisconnectConnectionLimit)
			return
		}
		var semaphore chan struct{}
		if clientConcurrency > 1 {
			semaphore = make(chan struct{}, clientConcurrency)
		}
		logger.Debug("Client connected", "user", client.UserID(), "client", client.ID())
		connectedAt := time.Now()

		// Called when client subscribes to the channel.
		client.OnSubscribe(func(e centrifuge.SubscribeEvent, cb centrifuge.SubscribeCallback) {
			err := runConcurrentlyIfNeeded(client.Context(), semaphore, func() {
				cb(g.handleOnSubscribe(client, e))
			})
			if err != nil {
				cb(centrifuge.SubscribeReply{}, err)
			}
		})

		// Called when a client publishes to the channel.
		// In general, we should prefer writing to the HTTP API, but this
		// allows some simple prototypes to work quickly.
		client.OnPublish(func(e centrifuge.PublishEvent, cb centrifuge.PublishCallback) {
			err := runConcurrentlyIfNeeded(client.Context(), semaphore, func() {
				cb(g.handleOnPublish(client, e))
			})
			if err != nil {
				cb(centrifuge.PublishReply{}, err)
			}
		})

		client.OnDisconnect(func(e centrifuge.DisconnectEvent) {
			reason := "normal"
			if e.Disconnect != nil {
				reason = e.Disconnect.Reason
				if e.Disconnect.Code == 3001 { // Shutdown
					return
				}
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

	// Use a pure websocket transport.
	wsHandler := centrifuge.NewWebsocketHandler(node, centrifuge.WebsocketConfig{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     checkOrigin,
	})

	pushWSHandler := pushws.NewHandler(g.ManagedStreamRunner, pushws.Config{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     checkOrigin,
	})

	g.websocketHandler = func(ctx *models.ReqContext) {
		user := ctx.SignedInUser

		// Centrifuge expects Credentials in context with a current user ID.
		cred := &centrifuge.Credentials{
			UserID: fmt.Sprintf("%d", user.UserId),
		}
		newCtx := centrifuge.SetCredentials(ctx.Req.Context(), cred)
		newCtx = livecontext.SetContextSignedUser(newCtx, user)
		r := ctx.Req.WithContext(newCtx)
		wsHandler.ServeHTTP(ctx.Resp, r)
	}

	g.pushWebsocketHandler = func(ctx *models.ReqContext) {
		user := ctx.SignedInUser
		newCtx := livecontext.SetContextSignedUser(ctx.Req.Context(), user)
		newCtx = livecontext.SetContextStreamID(newCtx, web.Params(ctx.Req)[":streamId"])
		r := ctx.Req.WithContext(newCtx)
		pushWSHandler.ServeHTTP(ctx.Resp, r)
	}

	g.RouteRegister.Group("/api/live", func(group routing.RouteRegister) {
		group.Get("/ws", g.websocketHandler)
	}, middleware.ReqSignedIn)

	g.RouteRegister.Group("/api/live", func(group routing.RouteRegister) {
		group.Get("/push/:streamId", g.pushWebsocketHandler)
	}, middleware.ReqOrgAdmin)

	g.registerUsageMetrics()

	return g, nil
}

// GrafanaLive manages live real-time connections to Grafana (over WebSocket at this moment).
// The main concept here is Channel. Connections can subscribe to many channels. Each channel
// can have different permissions and properties but once a connection subscribed to a channel
// it starts receiving all messages published into this channel. Thus GrafanaLive is a PUB/SUB
// server.
type GrafanaLive struct {
	PluginContextProvider *plugincontext.Provider
	Cfg                   *setting.Cfg
	RouteRegister         routing.RouteRegister
	LogsService           *cloudwatch.LogsService
	CacheService          *localcache.CacheService
	DataSourceCache       datasources.CacheService
	SQLStore              *sqlstore.SQLStore
	EncryptionService     encryption.Service
	pluginStore           plugins.Store

	node         *centrifuge.Node
	surveyCaller *survey.Caller

	// Websocket handlers
	websocketHandler     interface{}
	pushWebsocketHandler interface{}

	// Full channel handler
	channels   map[string]models.ChannelHandler
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

func (g *GrafanaLive) getStreamPlugin(pluginID string) (backend.StreamHandler, error) {
	plugin := g.pluginStore.Plugin(pluginID)
	if plugin == nil {
		return nil, fmt.Errorf("plugin not found: %s", pluginID)
	}
	if plugin.SupportsStreaming() {
		return plugin, nil
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

var clientConcurrency = 8

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

func (g *GrafanaLive) handleOnSubscribe(client *centrifuge.Client, e centrifuge.SubscribeEvent) (centrifuge.SubscribeReply, error) {
	logger.Debug("Client wants to subscribe", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)

	user, ok := livecontext.GetContextSignedUser(client.Context())
	if !ok {
		logger.Error("No user found in context", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
		return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
	}

	// See a detailed comment for StripOrgID about orgID management in Live.
	orgID, channel, err := orgchannel.StripOrgID(e.Channel)
	if err != nil {
		logger.Error("Error parsing channel", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
		return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
	}

	if user.OrgId != orgID {
		logger.Info("Error subscribing: wrong orgId", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
		return centrifuge.SubscribeReply{}, centrifuge.ErrorPermissionDenied
	}

	var reply models.SubscribeReply
	var status backend.SubscribeStreamStatus
	var ruleFound bool

	if g.Pipeline != nil {
		rule, ok, err := g.Pipeline.Get(user.OrgId, channel)
		if err != nil {
			logger.Error("Error getting channel rule", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
			return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
		}
		ruleFound = ok
		if ok {
			if rule.SubscribeAuth != nil {
				ok, err := rule.SubscribeAuth.CanSubscribe(client.Context(), user)
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
					reply, status, err = sub.Subscribe(client.Context(), pipeline.Vars{
						OrgID:   orgID,
						Channel: channel,
					})
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
		handler, addr, err := g.GetChannelHandler(user, channel)
		if err != nil {
			if errors.Is(err, live.ErrInvalidChannelID) {
				logger.Info("Invalid channel ID", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
				return centrifuge.SubscribeReply{}, &centrifuge.Error{Code: uint32(http.StatusBadRequest), Message: "invalid channel ID"}
			}
			logger.Error("Error getting channel handler", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
			return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
		}
		reply, status, err = handler.OnSubscribe(client.Context(), user, models.SubscribeEvent{
			Channel: channel,
			Path:    addr.Path,
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
			Presence:  reply.Presence,
			JoinLeave: reply.JoinLeave,
			Recover:   reply.Recover,
			Data:      reply.Data,
		},
	}, nil
}

func (g *GrafanaLive) handleOnPublish(client *centrifuge.Client, e centrifuge.PublishEvent) (centrifuge.PublishReply, error) {
	logger.Debug("Client wants to publish", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)

	user, ok := livecontext.GetContextSignedUser(client.Context())
	if !ok {
		logger.Error("No user found in context", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
		return centrifuge.PublishReply{}, centrifuge.ErrorInternal
	}

	// See a detailed comment for StripOrgID about orgID management in Live.
	orgID, channel, err := orgchannel.StripOrgID(e.Channel)
	if err != nil {
		logger.Error("Error parsing channel", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
		return centrifuge.PublishReply{}, centrifuge.ErrorInternal
	}

	if user.OrgId != orgID {
		logger.Info("Error subscribing: wrong orgId", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
		return centrifuge.PublishReply{}, centrifuge.ErrorPermissionDenied
	}

	if g.Pipeline != nil {
		rule, ok, err := g.Pipeline.Get(user.OrgId, channel)
		if err != nil {
			logger.Error("Error getting channel rule", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
			return centrifuge.PublishReply{}, centrifuge.ErrorInternal
		}
		if ok {
			if rule.PublishAuth != nil {
				ok, err := rule.PublishAuth.CanPublish(client.Context(), user)
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
				if !user.HasRole(models.ROLE_ADMIN) {
					// using HTTP error codes for WS errors too.
					code, text := publishStatusToHTTPError(backend.PublishStreamStatusPermissionDenied)
					return centrifuge.PublishReply{}, &centrifuge.Error{Code: uint32(code), Message: text}
				}
			}
			_, err := g.Pipeline.ProcessInput(client.Context(), user.OrgId, channel, e.Data)
			if err != nil {
				logger.Error("Error processing input", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
				return centrifuge.PublishReply{}, centrifuge.ErrorInternal
			}
			return centrifuge.PublishReply{
				Result: &centrifuge.PublishResult{},
			}, nil
		}
	}

	handler, addr, err := g.GetChannelHandler(user, channel)
	if err != nil {
		if errors.Is(err, live.ErrInvalidChannelID) {
			logger.Info("Invalid channel ID", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
			return centrifuge.PublishReply{}, &centrifuge.Error{Code: uint32(http.StatusBadRequest), Message: "invalid channel ID"}
		}
		logger.Error("Error getting channel handler", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
		return centrifuge.PublishReply{}, centrifuge.ErrorInternal
	}
	reply, status, err := handler.OnPublish(client.Context(), user, models.PublishEvent{
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
		logger.Warn("unknown subscribe status", "status", status)
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
		logger.Warn("unknown publish status", "status", status)
		return http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError)
	}
}

// GetChannelHandler gives thread-safe access to the channel.
func (g *GrafanaLive) GetChannelHandler(user *models.SignedInUser, channel string) (models.ChannelHandler, live.Channel, error) {
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

	getter, err := g.GetChannelHandlerFactory(user, addr.Scope, addr.Namespace)
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
func (g *GrafanaLive) GetChannelHandlerFactory(user *models.SignedInUser, scope string, namespace string) (models.ChannelHandlerFactory, error) {
	switch scope {
	case live.ScopeGrafana:
		return g.handleGrafanaScope(user, namespace)
	case live.ScopePlugin:
		return g.handlePluginScope(user, namespace)
	case live.ScopeDatasource:
		return g.handleDatasourceScope(user, namespace)
	case live.ScopeStream:
		return g.handleStreamScope(user, namespace)
	default:
		return nil, fmt.Errorf("invalid scope: %q", scope)
	}
}

func (g *GrafanaLive) handleGrafanaScope(_ *models.SignedInUser, namespace string) (models.ChannelHandlerFactory, error) {
	if p, ok := g.GrafanaScope.Features[namespace]; ok {
		return p, nil
	}
	return nil, fmt.Errorf("unknown feature: %q", namespace)
}

func (g *GrafanaLive) handlePluginScope(_ *models.SignedInUser, namespace string) (models.ChannelHandlerFactory, error) {
	// Temporary hack until we have a more generic solution later on
	if namespace == "cloudwatch" {
		return &cloudwatch.LogQueryRunnerSupplier{
			Publisher: g.Publish,
			Service:   g.LogsService,
		}, nil
	}
	streamHandler, err := g.getStreamPlugin(namespace)
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

func (g *GrafanaLive) handleStreamScope(u *models.SignedInUser, namespace string) (models.ChannelHandlerFactory, error) {
	return g.ManagedStreamRunner.GetOrCreateStream(u.OrgId, live.ScopeStream, namespace)
}

func (g *GrafanaLive) handleDatasourceScope(user *models.SignedInUser, namespace string) (models.ChannelHandlerFactory, error) {
	ds, err := g.DataSourceCache.GetDatasourceByUID(namespace, user, false)
	if err != nil {
		return nil, fmt.Errorf("error getting datasource: %w", err)
	}
	streamHandler, err := g.getStreamPlugin(ds.Type)
	if err != nil {
		return nil, fmt.Errorf("can't find stream plugin: %s", ds.Type)
	}
	return features.NewPluginRunner(
		ds.Type,
		ds.Uid,
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

func (g *GrafanaLive) HandleHTTPPublish(ctx *models.ReqContext, cmd dtos.LivePublishCmd) response.Response {
	addr, err := live.ParseChannel(cmd.Channel)
	if err != nil {
		return response.Error(http.StatusBadRequest, "invalid channel ID", nil)
	}

	logger.Debug("Publish API cmd", "user", ctx.SignedInUser.UserId, "channel", cmd.Channel)
	user := ctx.SignedInUser
	channel := cmd.Channel

	if g.Pipeline != nil {
		rule, ok, err := g.Pipeline.Get(user.OrgId, channel)
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
				if !user.HasRole(models.ROLE_ADMIN) {
					return response.Error(http.StatusForbidden, http.StatusText(http.StatusForbidden), nil)
				}
			}
			_, err := g.Pipeline.ProcessInput(ctx.Req.Context(), user.OrgId, channel, cmd.Data)
			if err != nil {
				logger.Error("Error processing input", "user", user, "channel", channel, "error", err)
				return response.Error(http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError), nil)
			}
			return response.JSON(http.StatusOK, dtos.LivePublishResponse{})
		}
	}

	channelHandler, addr, err := g.GetChannelHandler(ctx.SignedInUser, cmd.Channel)
	if err != nil {
		logger.Error("Error getting channels handler", "error", err, "channel", cmd.Channel)
		return response.Error(http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError), nil)
	}

	reply, status, err := channelHandler.OnPublish(ctx.Req.Context(), ctx.SignedInUser, models.PublishEvent{Channel: cmd.Channel, Path: addr.Path, Data: cmd.Data})
	if err != nil {
		logger.Error("Error calling OnPublish", "error", err, "channel", cmd.Channel)
		return response.Error(http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError), nil)
	}

	if status != backend.PublishStreamStatusOK {
		code, text := publishStatusToHTTPError(status)
		return response.Error(code, text, nil)
	}
	if reply.Data != nil {
		err = g.Publish(ctx.OrgId, cmd.Channel, cmd.Data)
		if err != nil {
			logger.Error("Error publish to channel", "error", err, "channel", cmd.Channel)
			return response.Error(http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError), nil)
		}
	}
	logger.Debug("Publication successful", "user", ctx.SignedInUser.UserId, "channel", cmd.Channel)
	return response.JSON(http.StatusOK, dtos.LivePublishResponse{})
}

type streamChannelListResponse struct {
	Channels []*managedstream.ManagedChannel `json:"channels"`
}

// HandleListHTTP returns metadata so the UI can build a nice form
func (g *GrafanaLive) HandleListHTTP(c *models.ReqContext) response.Response {
	var channels []*managedstream.ManagedChannel
	var err error
	if g.IsHA() {
		channels, err = g.surveyCaller.CallManagedStreams(c.SignedInUser.OrgId)
	} else {
		channels, err = g.ManagedStreamRunner.GetManagedChannels(c.SignedInUser.OrgId)
	}
	if err != nil {
		return response.Error(http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError), err)
	}
	info := streamChannelListResponse{
		Channels: channels,
	}
	return response.JSONStreaming(200, info)
}

// HandleInfoHTTP special http response for
func (g *GrafanaLive) HandleInfoHTTP(ctx *models.ReqContext) response.Response {
	path := web.Params(ctx.Req)["*"]
	if path == "grafana/dashboards/gitops" {
		return response.JSON(200, util.DynMap{
			"active": g.GrafanaScope.Dashboards.HasGitOpsObserver(ctx.SignedInUser.OrgId),
		})
	}
	return response.JSONStreaming(404, util.DynMap{
		"message": "Info is not supported for this channel",
	})
}

// HandleChannelRulesListHTTP ...
func (g *GrafanaLive) HandleChannelRulesListHTTP(c *models.ReqContext) response.Response {
	result, err := g.pipelineStorage.ListChannelRules(c.Req.Context(), c.OrgId)
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
func (g *GrafanaLive) HandlePipelineConvertTestHTTP(c *models.ReqContext) response.Response {
	body, err := ioutil.ReadAll(c.Req.Body)
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
	rule, ok, err := channelRuleGetter.Get(c.OrgId, req.Channel)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error getting channel rule", err)
	}
	if !ok {
		return response.Error(http.StatusNotFound, "No rule found", nil)
	}
	if rule.Converter == nil {
		return response.Error(http.StatusNotFound, "No converter found", nil)
	}
	channelFrames, err := pipe.DataToChannelFrames(c.Req.Context(), *rule, c.OrgId, req.Channel, []byte(req.Data))
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error converting data", err)
	}
	return response.JSON(http.StatusOK, ConvertDryRunResponse{
		ChannelFrames: channelFrames,
	})
}

// HandleChannelRulesPostHTTP ...
func (g *GrafanaLive) HandleChannelRulesPostHTTP(c *models.ReqContext) response.Response {
	body, err := ioutil.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error reading body", err)
	}
	var cmd pipeline.ChannelRuleCreateCmd
	err = json.Unmarshal(body, &cmd)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Error decoding channel rule", err)
	}
	rule, err := g.pipelineStorage.CreateChannelRule(c.Req.Context(), c.OrgId, cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to create channel rule", err)
	}
	return response.JSON(http.StatusOK, util.DynMap{
		"rule": rule,
	})
}

// HandleChannelRulesPutHTTP ...
func (g *GrafanaLive) HandleChannelRulesPutHTTP(c *models.ReqContext) response.Response {
	body, err := ioutil.ReadAll(c.Req.Body)
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
	rule, err := g.pipelineStorage.UpdateChannelRule(c.Req.Context(), c.OrgId, cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update channel rule", err)
	}
	return response.JSON(http.StatusOK, util.DynMap{
		"rule": rule,
	})
}

// HandleChannelRulesDeleteHTTP ...
func (g *GrafanaLive) HandleChannelRulesDeleteHTTP(c *models.ReqContext) response.Response {
	body, err := ioutil.ReadAll(c.Req.Body)
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
	err = g.pipelineStorage.DeleteChannelRule(c.Req.Context(), c.OrgId, cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to delete channel rule", err)
	}
	return response.JSON(http.StatusOK, util.DynMap{})
}

// HandlePipelineEntitiesListHTTP ...
func (g *GrafanaLive) HandlePipelineEntitiesListHTTP(_ *models.ReqContext) response.Response {
	return response.JSON(http.StatusOK, util.DynMap{
		"subscribers":     pipeline.SubscribersRegistry,
		"dataOutputs":     pipeline.DataOutputsRegistry,
		"converters":      pipeline.ConvertersRegistry,
		"frameProcessors": pipeline.FrameProcessorsRegistry,
		"frameOutputs":    pipeline.FrameOutputsRegistry,
	})
}

// HandleWriteConfigsListHTTP ...
func (g *GrafanaLive) HandleWriteConfigsListHTTP(c *models.ReqContext) response.Response {
	backends, err := g.pipelineStorage.ListWriteConfigs(c.Req.Context(), c.OrgId)
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
func (g *GrafanaLive) HandleWriteConfigsPostHTTP(c *models.ReqContext) response.Response {
	body, err := ioutil.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error reading body", err)
	}
	var cmd pipeline.WriteConfigCreateCmd
	err = json.Unmarshal(body, &cmd)
	if err != nil {
		return response.Error(http.StatusBadRequest, "Error decoding write config create command", err)
	}
	result, err := g.pipelineStorage.CreateWriteConfig(c.Req.Context(), c.OrgId, cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to create write config", err)
	}
	return response.JSON(http.StatusOK, util.DynMap{
		"writeConfig": pipeline.WriteConfigToDto(result),
	})
}

// HandleWriteConfigsPutHTTP ...
func (g *GrafanaLive) HandleWriteConfigsPutHTTP(c *models.ReqContext) response.Response {
	body, err := ioutil.ReadAll(c.Req.Body)
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
	existingBackend, ok, err := g.pipelineStorage.GetWriteConfig(c.Req.Context(), c.OrgId, pipeline.WriteConfigGetCmd{
		UID: cmd.UID,
	})
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get write config", err)
	}
	if ok {
		if cmd.SecureSettings == nil {
			cmd.SecureSettings = map[string]string{}
		}
		secureJSONData, err := g.EncryptionService.DecryptJsonData(c.Req.Context(), existingBackend.SecureSettings, setting.SecretKey)
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
	result, err := g.pipelineStorage.UpdateWriteConfig(c.Req.Context(), c.OrgId, cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update write config", err)
	}
	return response.JSON(http.StatusOK, util.DynMap{
		"writeConfig": pipeline.WriteConfigToDto(result),
	})
}

// HandleWriteConfigsDeleteHTTP ...
func (g *GrafanaLive) HandleWriteConfigsDeleteHTTP(c *models.ReqContext) response.Response {
	body, err := ioutil.ReadAll(c.Req.Body)
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
	err = g.pipelineStorage.DeleteWriteConfig(c.Req.Context(), c.OrgId, cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to delete write config", err)
	}
	return response.JSON(http.StatusOK, util.DynMap{})
}

// Write to the standard log15 logger
func handleLog(msg centrifuge.LogEntry) {
	arr := make([]interface{}, 0)
	for k, v := range msg.Fields {
		if v == nil {
			v = "<nil>"
		} else if v == "" {
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

	g.usageStats.sampleCount++
	g.usageStats.numClientsSum += numClients
	g.usageStats.numUsersSum += numUsers

	if numClients > g.usageStats.numClientsMax {
		g.usageStats.numClientsMax = numClients
	}

	if numClients < g.usageStats.numClientsMin {
		g.usageStats.numClientsMin = numClients
	}

	if numUsers > g.usageStats.numUsersMax {
		g.usageStats.numUsersMax = numUsers
	}

	if numUsers < g.usageStats.numUsersMin {
		g.usageStats.numUsersMin = numUsers
	}
}

func (g *GrafanaLive) resetLiveStats() {
	g.usageStats = usageStats{}
}

func (g *GrafanaLive) registerUsageMetrics() {
	g.usageStatsService.RegisterSendReportCallback(g.resetLiveStats)

	g.usageStatsService.RegisterMetricsFunc(func(context.Context) (map[string]interface{}, error) {
		liveUsersAvg := 0
		liveClientsAvg := 0

		if g.usageStats.sampleCount > 0 {
			liveUsersAvg = g.usageStats.numUsersSum / g.usageStats.sampleCount
			liveClientsAvg = g.usageStats.numClientsSum / g.usageStats.sampleCount
		}

		metrics := map[string]interface{}{
			"stats.live_samples.count":     g.usageStats.sampleCount,
			"stats.live_users_max.count":   g.usageStats.numUsersMax,
			"stats.live_users_min.count":   g.usageStats.numUsersMin,
			"stats.live_users_avg.count":   liveUsersAvg,
			"stats.live_clients_max.count": g.usageStats.numClientsMax,
			"stats.live_clients_min.count": g.usageStats.numClientsMin,
			"stats.live_clients_avg.count": liveClientsAvg,
		}

		return metrics, nil
	})
}

type usageStats struct {
	numClientsMax int
	numClientsMin int
	numClientsSum int
	numUsersMax   int
	numUsersMin   int
	numUsersSum   int
	sampleCount   int
}
