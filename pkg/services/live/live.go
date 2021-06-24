package live

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/plugins/plugincontext"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/live/database"
	"github.com/grafana/grafana/pkg/services/live/features"
	"github.com/grafana/grafana/pkg/services/live/livecontext"
	"github.com/grafana/grafana/pkg/services/live/liveplugin"
	"github.com/grafana/grafana/pkg/services/live/managedstream"
	"github.com/grafana/grafana/pkg/services/live/orgchannel"
	"github.com/grafana/grafana/pkg/services/live/pushws"
	"github.com/grafana/grafana/pkg/services/live/runstream"
	"github.com/grafana/grafana/pkg/services/live/survey"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch"
	"github.com/grafana/grafana/pkg/util"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/live"
	"gopkg.in/redis.v5"
)

var (
	logger   = log.New("live")
	loggerCF = log.New("live.centrifuge")
)

func init() {
	registry.RegisterServiceWithPriority(NewGrafanaLive(), registry.Low)
}

func NewGrafanaLive() *GrafanaLive {
	return &GrafanaLive{
		channels:   make(map[string]models.ChannelHandler),
		channelsMu: sync.RWMutex{},
		GrafanaScope: CoreGrafanaScope{
			Features: make(map[string]models.ChannelHandlerFactory),
		},
	}
}

// CoreGrafanaScope list of core features
type CoreGrafanaScope struct {
	Features map[string]models.ChannelHandlerFactory

	// The generic service to advertise dashboard changes
	Dashboards models.DashboardActivityChannel
}

// GrafanaLive manages live real-time connections to Grafana (over WebSocket at this moment).
// The main concept here is Channel. Connections can subscribe to many channels. Each channel
// can have different permissions and properties but once a connection subscribed to a channel
// it starts receiving all messages published into this channel. Thus GrafanaLive is a PUB/SUB
// server.
type GrafanaLive struct {
	PluginContextProvider *plugincontext.Provider  `inject:""`
	Cfg                   *setting.Cfg             `inject:""`
	RouteRegister         routing.RouteRegister    `inject:""`
	LogsService           *cloudwatch.LogsService  `inject:""`
	PluginManager         *manager.PluginManager   `inject:""`
	CacheService          *localcache.CacheService `inject:""`
	DatasourceCache       datasources.CacheService `inject:""`
	SQLStore              *sqlstore.SQLStore       `inject:""`

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

	contextGetter    *liveplugin.ContextGetter
	runStreamManager *runstream.Manager
	storage          *database.Storage
}

func (g *GrafanaLive) getStreamPlugin(pluginID string) (backend.StreamHandler, error) {
	plugin, ok := g.PluginManager.BackendPluginManager.Get(pluginID)
	if !ok {
		return nil, fmt.Errorf("plugin not found: %s", pluginID)
	}
	streamHandler, ok := plugin.(backend.StreamHandler)
	if !ok {
		return nil, fmt.Errorf("%s plugin does not implement StreamHandler: %#v", pluginID, plugin)
	}
	return streamHandler, nil
}

// AddMigration defines database migrations.
// This is an implementation of registry.DatabaseMigrator.
func (g *GrafanaLive) AddMigration(mg *migrator.Migrator) {
	if g == nil || g.Cfg == nil || !g.Cfg.IsLiveConfigEnabled() {
		return
	}
	database.AddLiveChannelMigrations(mg)
}

func (g *GrafanaLive) Run(ctx context.Context) error {
	if g.runStreamManager != nil {
		// Only run stream manager if GrafanaLive properly initialized.
		_ = g.runStreamManager.Run(ctx)
		return g.node.Shutdown(context.Background())
	}
	return nil
}

var clientConcurrency = 8

func (g *GrafanaLive) IsHA() bool {
	return g.Cfg != nil && g.Cfg.LiveHAEngine != ""
}

// Init initializes Live service.
// Required to implement the registry.Service interface.
func (g *GrafanaLive) Init() error {
	logger.Debug("GrafanaLive initialization", "ha", g.IsHA())

	// We use default config here as starting point. Default config contains
	// reasonable values for available options.
	cfg := centrifuge.DefaultConfig

	// cfg.LogLevel = centrifuge.LogLevelDebug
	cfg.LogHandler = handleLog
	cfg.LogLevel = centrifuge.LogLevelError
	cfg.MetricsNamespace = "grafana_live"

	// Node is the core object in Centrifuge library responsible for many useful
	// things. For example Node allows to publish messages to channels from server
	// side with its Publish method.
	node, err := centrifuge.New(cfg)
	if err != nil {
		return err
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
				return fmt.Errorf("error connecting to Live Redis: %v", err)
			}
			redisShards = append(redisShards, redisShard)
		}

		broker, err := centrifuge.NewRedisBroker(node, centrifuge.RedisBrokerConfig{
			Prefix: "gf_live",

			// We are using Redis streams here for history. Require Redis >= 5.
			UseStreams: true,

			// Use reasonably large expiration interval for stream meta key,
			// much bigger than maximum HistoryLifetime value in Node config.
			// This way stream meta data will expire, in some cases you may want
			// to prevent its expiration setting this to zero value.
			HistoryMetaTTL: 7 * 24 * time.Hour,

			// And configure a couple of shards to use.
			Shards: redisShards,
		})
		if err != nil {
			return fmt.Errorf("error creating Live Redis broker: %v", err)
		}
		node.SetBroker(broker)

		presenceManager, err := centrifuge.NewRedisPresenceManager(node, centrifuge.RedisPresenceManagerConfig{
			Prefix: "gf_live",
			Shards: redisShards,
		})
		if err != nil {
			return fmt.Errorf("error creating Live Redis presence manager: %v", err)
		}
		node.SetPresenceManager(presenceManager)
	}

	g.contextGetter = liveplugin.NewContextGetter(g.PluginContextProvider)
	channelLocalPublisher := liveplugin.NewChannelLocalPublisher(node)
	numLocalSubscribersGetter := liveplugin.NewNumLocalSubscribersGetter(node)
	g.runStreamManager = runstream.NewManager(channelLocalPublisher, numLocalSubscribersGetter, g.contextGetter)

	// Initialize the main features
	dash := &features.DashboardHandler{
		Publisher:   g.Publish,
		ClientCount: g.ClientCount,
	}
	g.storage = database.NewStorage(g.SQLStore, g.CacheService)
	g.GrafanaScope.Dashboards = dash
	g.GrafanaScope.Features["dashboard"] = dash
	g.GrafanaScope.Features["broadcast"] = features.NewBroadcastRunner(g.storage)

	var managedStreamRunner *managedstream.Runner
	if g.IsHA() {
		redisClient := redis.NewClient(&redis.Options{
			Addr: g.Cfg.LiveHAEngineAddress,
		})
		cmd := redisClient.Ping()
		if _, err := cmd.Result(); err != nil {
			return fmt.Errorf("error pinging Redis: %v", err)
		}
		managedStreamRunner = managedstream.NewRunner(
			g.Publish,
			managedstream.NewRedisFrameCache(redisClient),
		)
	} else {
		managedStreamRunner = managedstream.NewRunner(
			g.Publish,
			managedstream.NewMemoryFrameCache(),
		)
	}

	g.ManagedStreamRunner = managedStreamRunner
	g.surveyCaller = survey.NewCaller(managedStreamRunner, node)
	err = g.surveyCaller.SetupHandlers()
	if err != nil {
		return err
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
		return err
	}

	appURL, err := url.Parse(g.Cfg.AppURL)
	if err != nil {
		return fmt.Errorf("error parsing AppURL %s: %w", g.Cfg.AppURL, err)
	}

	// Use a pure websocket transport.
	wsHandler := centrifuge.NewWebsocketHandler(node, centrifuge.WebsocketConfig{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return checkOrigin(r, appURL)
		},
	})

	pushWSHandler := pushws.NewHandler(g.ManagedStreamRunner, pushws.Config{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return checkOrigin(r, appURL)
		},
	})

	g.websocketHandler = func(ctx *models.ReqContext) {
		user := ctx.SignedInUser

		// Centrifuge expects Credentials in context with a current user ID.
		cred := &centrifuge.Credentials{
			UserID: fmt.Sprintf("%d", user.UserId),
		}
		newCtx := centrifuge.SetCredentials(ctx.Req.Context(), cred)
		newCtx = livecontext.SetContextSignedUser(newCtx, user)
		newCtx = livecontext.SetContextValues(newCtx, ctx.Req.URL.Query())
		r := ctx.Req.Request
		r = r.WithContext(newCtx)
		wsHandler.ServeHTTP(ctx.Resp, r)
	}

	g.pushWebsocketHandler = func(ctx *models.ReqContext) {
		user := ctx.SignedInUser
		newCtx := livecontext.SetContextSignedUser(ctx.Req.Context(), user)
		newCtx = livecontext.SetContextValues(newCtx, ctx.Req.URL.Query())
		newCtx = livecontext.SetContextStreamID(newCtx, ctx.Params(":streamId"))
		r := ctx.Req.Request
		r = r.WithContext(newCtx)
		pushWSHandler.ServeHTTP(ctx.Resp, r)
	}

	g.RouteRegister.Group("/api/live", func(group routing.RouteRegister) {
		group.Get("/ws", g.websocketHandler)
	}, middleware.ReqSignedIn)

	g.RouteRegister.Group("/api/live", func(group routing.RouteRegister) {
		group.Get("/push/:streamId", g.pushWebsocketHandler)
	}, middleware.ReqOrgAdmin)

	return nil
}

func checkOrigin(r *http.Request, appURL *url.URL) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	originURL, err := url.Parse(origin)
	if err != nil {
		logger.Warn("Failed to parse request origin", "error", err, "origin", origin)
		return false
	}
	if !strings.EqualFold(originURL.Scheme, appURL.Scheme) || !strings.EqualFold(originURL.Host, appURL.Host) {
		logger.Warn("Request Origin is not authorized", "origin", origin, "appUrl", appURL.String())
		return false
	}
	return true
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

	handler, addr, err := g.GetChannelHandler(user, channel)
	if err != nil {
		if errors.Is(err, live.ErrInvalidChannelID) {
			logger.Info("Invalid channel ID", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
			return centrifuge.SubscribeReply{}, &centrifuge.Error{Code: uint32(http.StatusBadRequest), Message: "invalid channel ID"}
		}
		logger.Error("Error getting channel handler", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
		return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
	}
	reply, status, err := handler.OnSubscribe(client.Context(), user, models.SubscribeEvent{
		Channel: channel,
		Path:    addr.Path,
	})
	if err != nil {
		logger.Error("Error calling channel handler subscribe", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
		return centrifuge.SubscribeReply{}, centrifuge.ErrorInternal
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
		log.Warn("unknown subscribe status", "status", status)
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
		log.Warn("unknown publish status", "status", status)
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
	return g.ManagedStreamRunner.GetOrCreateStream(u.OrgId, namespace)
}

func (g *GrafanaLive) handleDatasourceScope(user *models.SignedInUser, namespace string) (models.ChannelHandlerFactory, error) {
	ds, err := g.DatasourceCache.GetDatasourceByUID(namespace, user, false)
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
		_, err = g.node.Publish(cmd.Channel, cmd.Data)
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
	path := ctx.Params("*")
	if path == "grafana/dashboards/gitops" {
		return response.JSON(200, util.DynMap{
			"active": g.GrafanaScope.Dashboards.HasGitOpsObserver(ctx.SignedInUser.OrgId),
		})
	}
	return response.JSONStreaming(404, util.DynMap{
		"message": "Info is not supported for this channel",
	})
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
