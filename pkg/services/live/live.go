package live

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/manager"
	"github.com/grafana/grafana/pkg/plugins/plugincontext"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/live/features"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch"
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

	// The websocket handler
	WebsocketHandler interface{}

	// Full channel handler
	channels   map[string]models.ChannelHandler
	channelsMu sync.RWMutex

	// The core internal features
	GrafanaScope CoreGrafanaScope

	contextGetter *pluginContextGetter
	streamManager *features.StreamManager
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
	if g.streamManager != nil {
		// Only run stream manager if GrafanaLive properly initialized.
		return g.streamManager.Run(ctx)
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

	// Node is the core object in Centrifuge library responsible for many useful
	// things. For example Node allows to publish messages to channels from server
	// side with its Publish method.
	node, err := centrifuge.New(cfg)
	if err != nil {
		return err
	}
	g.node = node

	g.contextGetter = newPluginContextGetter(g.PluginContextProvider)

	channelPublisher := newPluginChannelPublisher(node)
	presenceGetter := newPluginPresenceGetter(node)
	g.streamManager = features.NewStreamManager(channelPublisher, presenceGetter)

	// Initialize the main features
	dash := &features.DashboardHandler{
		Publisher: g.Publish,
	}
	g.GrafanaScope.Dashboards = dash
	g.GrafanaScope.Features["dashboard"] = dash
	g.GrafanaScope.Features["broadcast"] = &features.BroadcastRunner{}
	g.GrafanaScope.Features["measurements"] = &features.MeasurementsRunner{}

	// Set ConnectHandler called when client successfully connected to Node. Your code
	// inside handler must be synchronized since it will be called concurrently from
	// different goroutines (belonging to different client connections). This is also
	// true for other event handlers.
	node.OnConnect(func(client *centrifuge.Client) {
		logger.Debug("Client connected", "user", client.UserID(), "client", client.ID())
		connectedAt := time.Now()

		client.OnSubscribe(func(e centrifuge.SubscribeEvent, cb centrifuge.SubscribeCallback) {
			logger.Debug("Client wants to subscribe", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
			user, ok := getContextSignedUser(client.Context())
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
				reply, allowed, err := handler.OnSubscribe(client.Context(), user, models.SubscribeEvent{
					Channel: e.Channel,
					Path:    addr.Path,
				})
				if err != nil {
					cb(centrifuge.SubscribeReply{}, centrifuge.ErrorInternal)
					return
				}
				if !allowed {
					cb(centrifuge.SubscribeReply{}, centrifuge.ErrorPermissionDenied)
					return
				}
				cb(centrifuge.SubscribeReply{
					Options: centrifuge.SubscribeOptions{
						Presence:  reply.Presence,
						JoinLeave: reply.JoinLeave,
						Recover:   reply.Recover,
					},
				}, nil)
			}
		})

		// Called when a client publishes to the websocket channel.
		// In general, we should prefer writing to the HTTP API, but this
		// allows some simple prototypes to work quickly.
		client.OnPublish(func(e centrifuge.PublishEvent, cb centrifuge.PublishCallback) {
			logger.Debug("Client wants to publish", "user", client.UserID(), "client", client.ID(), "channel", e.Channel)
			user, ok := getContextSignedUser(client.Context())
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
				reply, allowed, err := handler.OnPublish(client.Context(), user, models.PublishEvent{
					Channel: e.Channel,
					Path:    addr.Path,
				})
				if err != nil {
					cb(centrifuge.PublishReply{}, centrifuge.ErrorInternal)
					return
				}
				if !allowed {
					cb(centrifuge.PublishReply{}, centrifuge.ErrorPermissionDenied)
					return
				}
				cb(centrifuge.PublishReply{
					Options: centrifuge.PublishOptions{
						HistorySize: reply.HistorySize,
						HistoryTTL:  reply.HistoryTTL,
					},
				}, nil)
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

	g.WebsocketHandler = func(ctx *models.ReqContext) {
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
		newCtx = setContextSignedUser(newCtx, user)

		r := ctx.Req.Request
		r = r.WithContext(newCtx) // Set a user ID.

		wsHandler.ServeHTTP(ctx.Resp, r)
	}

	g.RouteRegister.Get("/live/ws", g.WebsocketHandler)

	return nil
}

// GetChannelHandler gives thread-safe access to the channel.
func (g *GrafanaLive) GetChannelHandler(user *models.SignedInUser, channel string) (models.ChannelHandler, ChannelAddress, error) {
	// Parse the identifier ${scope}/${namespace}/${path}
	addr := ParseChannelAddress(channel)
	if !addr.IsValid() {
		return nil, ChannelAddress{}, fmt.Errorf("invalid channel: %q", channel)
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
	case ScopeGrafana:
		return g.handleGrafanaScope(user, namespace)
	case ScopePlugin:
		return g.handlePluginScope(user, namespace)
	case ScopeDatasource:
		return g.handleDatasourceScope(user, namespace)
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
		"",
		g.streamManager,
		g.contextGetter,
		streamHandler,
	), nil
}

func (g *GrafanaLive) handleDatasourceScope(user *models.SignedInUser, namespace string) (models.ChannelHandlerFactory, error) {
	ds, err := g.DatasourceCache.GetDatasourceByUID(namespace, user, false)
	if err != nil {
		return nil, fmt.Errorf("error getting datasource: %w", err)
	}
	streamHandler, err := g.getStreamPlugin(ds.Name)
	if err != nil {
		return nil, fmt.Errorf("can't find stream plugin: %s", namespace)
	}
	return features.NewPluginRunner(
		ds.Type,
		ds.Uid,
		g.streamManager,
		g.contextGetter,
		streamHandler,
	), nil
}

// Publish sends the data to the channel without checking permissions etc
func (g *GrafanaLive) Publish(channel string, data []byte) error {
	_, err := g.node.Publish(channel, data)
	return err
}

// IsEnabled returns true if the Grafana Live feature is enabled.
func (g *GrafanaLive) IsEnabled() bool {
	return g.Cfg.IsLiveEnabled()
}

func (g *GrafanaLive) HandleHTTPPublish(ctx *models.ReqContext, cmd dtos.LivePublishCmd) response.Response {
	addr := ParseChannelAddress(cmd.Channel)
	if !addr.IsValid() {
		return response.Error(http.StatusBadRequest, "Bad channel address", nil)
	}

	logger.Debug("Publish API cmd", "cmd", cmd)

	channelHandler, addr, err := g.GetChannelHandler(ctx.SignedInUser, cmd.Channel)
	if err != nil {
		logger.Error("Error getting channels handler", "error", err, "channel", cmd.Channel)
		return response.Error(http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError), nil)
	}

	_, allowed, err := channelHandler.OnPublish(ctx.Req.Context(), ctx.SignedInUser, models.PublishEvent{Channel: cmd.Channel, Path: addr.Path, Data: cmd.Data})
	if err != nil {
		logger.Error("Error calling OnPublish", "error", err, "channel", cmd.Channel)
		return response.Error(http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError), nil)
	}
	if !allowed {
		return response.Error(http.StatusForbidden, http.StatusText(http.StatusForbidden), nil)
	}
	return response.JSON(200, dtos.LivePublishResponse{})
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
