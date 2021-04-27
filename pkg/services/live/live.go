package live

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/plugins/plugincontext"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/live/demultiplexer"
	"github.com/grafana/grafana/pkg/services/live/features"
	"github.com/grafana/grafana/pkg/services/live/livecontext"
	"github.com/grafana/grafana/pkg/services/live/managedstream"
	"github.com/grafana/grafana/pkg/services/live/pushws"
	"github.com/grafana/grafana/pkg/services/live/runstream"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch"
	"github.com/grafana/grafana/pkg/util"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/live"
)

var (
	logger   = log.New("live")
	loggerCF = log.New("live.centrifuge")
)

func init() {
	registry.RegisterServiceWithPriority(&GrafanaLive{
		channels:   make(map[string]models.ChannelHandler),
		channelsMu: sync.RWMutex{},
		GrafanaScope: CoreGrafanaScope{
			Features: make(map[string]models.ChannelHandlerFactory),
		},
	}, registry.Low)
}

// CoreGrafanaScope list of core features
type CoreGrafanaScope struct {
	Features map[string]models.ChannelHandlerFactory

	// The generic service to advertise dashboard changes
	Dashboards models.DashboardActivityChannel
}

// GrafanaLive pretends to be the server
type GrafanaLive struct {
	PluginContextProvider *plugincontext.Provider  `inject:""`
	Cfg                   *setting.Cfg             `inject:""`
	RouteRegister         routing.RouteRegister    `inject:""`
	LogsService           *cloudwatch.LogsService  `inject:""`
	PluginManager         *manager.PluginManager   `inject:""`
	DatasourceCache       datasources.CacheService `inject:""`

	node *centrifuge.Node

	// Websocket handlers
	websocketHandler     interface{}
	pushWebsocketHandler interface{}

	// Full channel handler
	channels   map[string]models.ChannelHandler
	channelsMu sync.RWMutex

	// The core internal features
	GrafanaScope CoreGrafanaScope

	ManagedStreamRunner *managedstream.Runner

	contextGetter    *pluginContextGetter
	runStreamManager *runstream.Manager
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

func (g *GrafanaLive) Run(ctx context.Context) error {
	if g.runStreamManager != nil {
		// Only run stream manager if GrafanaLive properly initialized.
		return g.runStreamManager.Run(ctx)
	}
	return nil
}

// Init initializes Live service.
// Required to implement the registry.Service interface.
func (g *GrafanaLive) Init() error {
	logger.Debug("GrafanaLive initialization")

	if !g.IsEnabled() {
		logger.Debug("GrafanaLive feature not enabled, skipping initialization")
		return nil
	}

	// We use default config here as starting point. Default config contains
	// reasonable values for available options.
	cfg := centrifuge.DefaultConfig

	// cfg.LogLevel = centrifuge.LogLevelDebug
	cfg.LogHandler = handleLog
	cfg.LogLevel = centrifuge.LogLevelError

	// Node is the core object in Centrifuge library responsible for many useful
	// things. For example Node allows to publish messages to channels from server
	// side with its Publish method.
	node, err := centrifuge.New(cfg)
	if err != nil {
		return err
	}
	g.node = node

	g.contextGetter = newPluginContextGetter(g.PluginContextProvider)
	packetSender := newPluginPacketSender(node)
	presenceGetter := newPluginPresenceGetter(node)
	g.runStreamManager = runstream.NewManager(packetSender, presenceGetter)

	// Initialize the main features
	dash := &features.DashboardHandler{
		Publisher:   g.Publish,
		ClientCount: g.ClientCount,
	}
	g.GrafanaScope.Dashboards = dash
	g.GrafanaScope.Features["dashboard"] = dash
	g.GrafanaScope.Features["broadcast"] = &features.BroadcastRunner{}

	g.ManagedStreamRunner = managedstream.NewRunner(g.Publish)

	// Set ConnectHandler called when client successfully connected to Node. Your code
	// inside handler must be synchronized since it will be called concurrently from
	// different goroutines (belonging to different client connections). This is also
	// true for other event handlers.
	node.OnConnect(func(client *centrifuge.Client) {
		logger.Debug("Client connected", "user", client.UserID(), "client", client.ID())
		connectedAt := time.Now()

		client.OnSubscribe(func(e centrifuge.SubscribeEvent, cb centrifuge.SubscribeCallback) {
			logger.Debug("Client wants to subscribe", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
			user, ok := livecontext.GetContextSignedUser(client.Context())
			if !ok {
				logger.Error("Unauthenticated live connection")
				cb(centrifuge.SubscribeReply{}, centrifuge.ErrorInternal)
				return
			}
			handler, addr, err := g.GetChannelHandler(user, e.Channel)
			if err != nil {
				logger.Error("Error getting channel handler", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
				cb(centrifuge.SubscribeReply{}, err)
			} else {
				reply, status, err := handler.OnSubscribe(client.Context(), user, models.SubscribeEvent{
					Channel: e.Channel,
					Path:    addr.Path,
				})
				if err != nil {
					logger.Error("Error calling channel handler subscribe", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
					cb(centrifuge.SubscribeReply{}, centrifuge.ErrorInternal)
					return
				}
				if status != backend.SubscribeStreamStatusOK {
					// using HTTP error codes for WS errors too.
					code, text := subscribeStatusToHTTPError(status)
					logger.Debug("Return custom subscribe error", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "code", code)
					cb(centrifuge.SubscribeReply{}, &centrifuge.Error{Code: uint32(code), Message: text})
					return
				}
				logger.Debug("Client subscribed", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
				cb(centrifuge.SubscribeReply{
					Options: centrifuge.SubscribeOptions{
						Presence:  reply.Presence,
						JoinLeave: reply.JoinLeave,
						Recover:   reply.Recover,
						Data:      reply.Data,
					},
				}, nil)
			}
		})

		// Called when a client publishes to the websocket channel.
		// In general, we should prefer writing to the HTTP API, but this
		// allows some simple prototypes to work quickly.
		client.OnPublish(func(e centrifuge.PublishEvent, cb centrifuge.PublishCallback) {
			logger.Debug("Client wants to publish", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
			user, ok := livecontext.GetContextSignedUser(client.Context())
			if !ok {
				logger.Error("Unauthenticated live connection")
				cb(centrifuge.PublishReply{}, centrifuge.ErrorInternal)
				return
			}
			handler, addr, err := g.GetChannelHandler(user, e.Channel)
			if err != nil {
				logger.Error("Error getting channel handler", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
				cb(centrifuge.PublishReply{}, err)
			} else {
				reply, status, err := handler.OnPublish(client.Context(), user, models.PublishEvent{
					Channel: e.Channel,
					Path:    addr.Path,
					Data:    e.Data,
				})
				if err != nil {
					logger.Error("Error calling channel handler publish", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
					cb(centrifuge.PublishReply{}, centrifuge.ErrorInternal)
					return
				}
				if status != backend.PublishStreamStatusOK {
					// using HTTP error codes for WS errors too.
					code, text := publishStatusToHTTPError(status)
					logger.Debug("Return custom publish error", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "code", code)
					cb(centrifuge.PublishReply{}, &centrifuge.Error{Code: uint32(code), Message: text})
					return
				}
				centrifugeReply := centrifuge.PublishReply{
					Options: centrifuge.PublishOptions{
						HistorySize: reply.HistorySize,
						HistoryTTL:  reply.HistoryTTL,
					},
				}
				if reply.Data != nil {
					result, err := g.node.Publish(e.Channel, reply.Data)
					if err != nil {
						logger.Error("Error publishing", "user", client.UserID(), "client", client.ID(), "channel", e.Channel, "error", err)
						cb(centrifuge.PublishReply{}, centrifuge.ErrorInternal)
						return
					}
					centrifugeReply.Result = &result
				}
				logger.Debug("Publication successful", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
				cb(centrifugeReply, nil)
			}
		})

		client.OnDisconnect(func(_ centrifuge.DisconnectEvent) {
			logger.Debug("Client disconnected", "user", client.UserID(), "client", client.ID(), "elapsed", time.Since(connectedAt))
		})
	})

	// Run node. This method does not block.
	if err := node.Run(); err != nil {
		return err
	}

	// Use a pure websocket transport.
	wsHandler := centrifuge.NewWebsocketHandler(node, centrifuge.WebsocketConfig{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	})

	pushWSHandler := pushws.NewHandler(g.ManagedStreamRunner, pushws.Config{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	})

	g.websocketHandler = func(ctx *models.ReqContext) {
		user := ctx.SignedInUser
		if user == nil {
			ctx.Resp.WriteHeader(401)
			return
		}

		// Centrifuge expects Credentials in context with a current user ID.
		cred := &centrifuge.Credentials{
			UserID: fmt.Sprintf("%d", user.UserId),
		}
		newCtx := centrifuge.SetCredentials(ctx.Req.Context(), cred)
		newCtx = livecontext.SetContextSignedUser(newCtx, user)
		newCtx = livecontext.SetContextValues(newCtx, ctx.Req.URL.Query())

		r := ctx.Req.Request
		r = r.WithContext(newCtx) // Set a user ID.

		wsHandler.ServeHTTP(ctx.Resp, r)
	}

	g.pushWebsocketHandler = func(ctx *models.ReqContext) {
		user := ctx.SignedInUser
		if user == nil {
			ctx.Resp.WriteHeader(401)
			return
		}

		// Centrifuge expects Credentials in context with a current user ID.
		cred := &centrifuge.Credentials{
			UserID: fmt.Sprintf("%d", user.UserId),
		}
		newCtx := centrifuge.SetCredentials(ctx.Req.Context(), cred)
		newCtx = livecontext.SetContextSignedUser(newCtx, user)
		newCtx = livecontext.SetContextValues(newCtx, ctx.Req.URL.Query())

		r := ctx.Req.Request
		r = r.WithContext(newCtx) // Set a user ID.

		pushWSHandler.ServeHTTP(ctx.Resp, r)
	}

	g.RouteRegister.Get("/live/ws", g.websocketHandler)
	g.RouteRegister.Get("/live/push", g.pushWebsocketHandler)
	return nil
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
	addr := live.ParseChannel(channel)
	if !addr.IsValid() {
		return nil, live.Channel{}, fmt.Errorf("invalid channel: %q", channel)
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
	case live.ScopePush:
		return g.handlePushScope(user, namespace)
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

func (g *GrafanaLive) handleStreamScope(_ *models.SignedInUser, namespace string) (models.ChannelHandlerFactory, error) {
	return g.ManagedStreamRunner.GetOrCreateStream(namespace)
}

func (g *GrafanaLive) handlePushScope(_ *models.SignedInUser, namespace string) (models.ChannelHandlerFactory, error) {
	return demultiplexer.New(namespace, g.ManagedStreamRunner), nil
}

func (g *GrafanaLive) handleDatasourceScope(user *models.SignedInUser, namespace string) (models.ChannelHandlerFactory, error) {
	ds, err := g.DatasourceCache.GetDatasourceByUID(namespace, user, false)
	if err != nil {
		// the namespace may be an ID
		id, _ := strconv.ParseInt(namespace, 10, 64)
		if id > 0 {
			ds, err = g.DatasourceCache.GetDatasource(id, user, false)
		}
		if err != nil {
			return nil, fmt.Errorf("error getting datasource: %w", err)
		}
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

// Publish sends the data to the channel without checking permissions etc
func (g *GrafanaLive) Publish(channel string, data []byte) error {
	_, err := g.node.Publish(channel, data)
	return err
}

// ClientCount returns the number of clients
func (g *GrafanaLive) ClientCount(channel string) (int, error) {
	p, err := g.node.Presence(channel)
	if err != nil {
		return 0, err
	}
	return len(p.Presence), nil
}

// IsEnabled returns true if the Grafana Live feature is enabled.
func (g *GrafanaLive) IsEnabled() bool {
	return g != nil && g.Cfg.IsLiveEnabled()
}

func (g *GrafanaLive) HandleHTTPPublish(ctx *models.ReqContext, cmd dtos.LivePublishCmd) response.Response {
	addr := live.ParseChannel(cmd.Channel)
	if !addr.IsValid() {
		return response.Error(http.StatusBadRequest, "Bad channel address", nil)
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

// HandleListHTTP returns metadata so the UI can build a nice form
func (g *GrafanaLive) HandleListHTTP(_ *models.ReqContext) response.Response {
	info := util.DynMap{}
	channels := make([]util.DynMap, 0)
	for k, v := range g.ManagedStreamRunner.Streams() {
		channels = append(channels, v.ListChannels("stream/"+k+"/")...)
	}

	// Hardcode sample streams
	frame := data.NewFrame("testdata",
		data.NewField("Time", nil, make([]time.Time, 0)),
		data.NewField("Value", nil, make([]float64, 0)),
		data.NewField("Min", nil, make([]float64, 0)),
		data.NewField("Max", nil, make([]float64, 0)),
	)
	channels = append(channels, util.DynMap{
		"channel": "plugin/testdata/random-2s-stream",
		"data":    frame,
	}, util.DynMap{
		"channel": "plugin/testdata/random-flakey-stream",
		"data":    frame,
	}, util.DynMap{
		"channel": "plugin/testdata/random-20Hz-stream",
		"data":    frame,
	})

	info["channels"] = channels
	return response.JSONStreaming(200, info)
}

// HandleInfoHTTP special http response for
func (g *GrafanaLive) HandleInfoHTTP(ctx *models.ReqContext) response.Response {
	path := ctx.Params("*")
	if path == "grafana/dashboards/gitops" {
		return response.JSON(200, util.DynMap{
			"active": g.GrafanaScope.Dashboards.HasGitOpsObserver(),
		})
	}
	return response.JSONStreaming(404, util.DynMap{
		"message": "Info is not supported for this channel",
	})
}
