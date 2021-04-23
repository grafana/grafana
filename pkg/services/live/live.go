package live

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/services/live/convert"
	"github.com/grafana/grafana/pkg/services/live/pushurl"

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
	"github.com/grafana/grafana/pkg/services/live/runstream"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch"
	"github.com/grafana/grafana/pkg/util"

	"github.com/centrifugal/centrifuge"
	"github.com/gorilla/websocket"
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

	// The websocket handler
	WebsocketHandler interface{}

	PushWebsocketHandler interface{}

	// Full channel handler
	channels   map[string]models.ChannelHandler
	channelsMu sync.RWMutex

	// The core internal features
	GrafanaScope CoreGrafanaScope

	ManagedStreamRunner *ManagedStreamRunner

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
		Publisher: g.Publish,
	}
	g.GrafanaScope.Dashboards = dash
	g.GrafanaScope.Features["dashboard"] = dash
	g.GrafanaScope.Features["broadcast"] = &features.BroadcastRunner{}

	g.ManagedStreamRunner = NewManagedStreamRunner(g.Publish)

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

	pushWSHandler := NewPushWebsocketHandler(g, WebsocketConfig{
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
		newCtx = setContextValues(newCtx, ctx.Req.URL.Query())

		r := ctx.Req.Request
		r = r.WithContext(newCtx) // Set a user ID.

		wsHandler.ServeHTTP(ctx.Resp, r)
	}

	g.PushWebsocketHandler = func(ctx *models.ReqContext) {
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
		newCtx = setContextValues(newCtx, ctx.Req.URL.Query())

		r := ctx.Req.Request
		r = r.WithContext(newCtx) // Set a user ID.

		pushWSHandler.ServeHTTP(ctx.Resp, r)
	}

	g.RouteRegister.Get("/live/ws", g.WebsocketHandler)
	g.RouteRegister.Get("/live/push", g.PushWebsocketHandler)

	return nil
}

// WebsocketHandler handles WebSocket client connections. WebSocket protocol
// is a bidirectional connection between a client an a server for low-latency
// communication.
type PushWebsocketHandler struct {
	GrafanaLive *GrafanaLive
	config      WebsocketConfig
	upgrade     *websocket.Upgrader
	converter   *convert.Converter
}

// WebsocketConfig represents config for WebsocketHandler.
type WebsocketConfig struct {
	// CompressionLevel sets a level for websocket compression.
	// See possible value description at https://golang.org/pkg/compress/flate/#NewWriter
	CompressionLevel int

	// CompressionMinSize allows to set minimal limit in bytes for
	// message to use compression when writing it into client connection.
	// By default it's 0 - i.e. all messages will be compressed when
	// WebsocketCompression enabled and compression negotiated with client.
	CompressionMinSize int

	// ReadBufferSize is a parameter that is used for raw websocket Upgrader.
	// If set to zero reasonable default value will be used.
	ReadBufferSize int

	// WriteBufferSize is a parameter that is used for raw websocket Upgrader.
	// If set to zero reasonable default value will be used.
	WriteBufferSize int

	// MessageSizeLimit sets the maximum size in bytes of allowed message from client.
	// By default DefaultWebsocketMaxMessageSize will be used.
	MessageSizeLimit int

	// CheckOrigin func to provide custom origin check logic.
	// nil means allow all origins.
	CheckOrigin func(r *http.Request) bool

	// PingInterval sets interval server will send ping messages to clients.
	// By default DefaultPingInterval will be used.
	PingInterval time.Duration

	// WriteTimeout is maximum time of write message operation.
	// Slow client will be disconnected.
	// By default DefaultWebsocketWriteTimeout will be used.
	WriteTimeout time.Duration

	// Compression allows to enable websocket permessage-deflate
	// compression support for raw websocket connections. It does
	// not guarantee that compression will be used - i.e. it only
	// says that server will try to negotiate it with client.
	Compression bool
}

// NewPushWebsocketHandler creates new PushWebsocketHandler.
func NewPushWebsocketHandler(g *GrafanaLive, c WebsocketConfig) *PushWebsocketHandler {
	upgrade := &websocket.Upgrader{
		ReadBufferSize:    c.ReadBufferSize,
		EnableCompression: c.Compression,
		WriteBufferSize:   c.WriteBufferSize,
		CheckOrigin:       c.CheckOrigin,
	}
	return &PushWebsocketHandler{
		GrafanaLive: g,
		config:      c,
		upgrade:     upgrade,
		converter:   convert.NewConverter(),
	}
}

// Defaults.
const (
	DefaultWebsocketPingInterval     = 25 * time.Second
	DefaultWebsocketWriteTimeout     = 1 * time.Second
	DefaultWebsocketMessageSizeLimit = 1024 * 1024 // 1MB
)

func (s *PushWebsocketHandler) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrade.Upgrade(rw, r, nil)
	if err != nil {
		return
	}

	pingInterval := s.config.PingInterval
	if pingInterval == 0 {
		pingInterval = DefaultWebsocketPingInterval
	}
	writeTimeout := s.config.WriteTimeout
	if writeTimeout == 0 {
		writeTimeout = DefaultWebsocketWriteTimeout
	}
	messageSizeLimit := s.config.MessageSizeLimit
	if messageSizeLimit == 0 {
		messageSizeLimit = DefaultWebsocketMessageSizeLimit
	}

	if messageSizeLimit > 0 {
		conn.SetReadLimit(int64(messageSizeLimit))
	}
	if pingInterval > 0 {
		pongWait := pingInterval * 10 / 9
		_ = conn.SetReadDeadline(time.Now().Add(pongWait))
		conn.SetPongHandler(func(string) error {
			_ = conn.SetReadDeadline(time.Now().Add(pongWait))
			return nil
		})
	}

	streamID := r.URL.Query().Get("stream")

	go func() {
		ticker := time.NewTicker(25 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-r.Context().Done():
				return
			case <-ticker.C:
				deadline := time.Now().Add(pingInterval / 2)
				err := conn.WriteControl(websocket.PingMessage, nil, deadline)
				if err != nil {
					return
				}
			}
		}
	}()

	for {
		_, body, err := conn.ReadMessage()
		if err != nil {
			break
		}

		stream, err := s.GrafanaLive.ManagedStreamRunner.GetOrCreateStream(streamID)
		if err != nil {
			logger.Error("Error getting stream", "error", err)
			continue
		}

		// TODO Grafana 8: decide which formats to use or keep all.
		urlValues := r.URL.Query()
		frameFormat := pushurl.FrameFormatFromValues(urlValues)
		stableSchema := pushurl.StableSchemaFromValues(urlValues)

		logger.Debug("Live Push request",
			"protocol", "http",
			"streamId", streamID,
			"bodyLength", len(body),
			"stableSchema", stableSchema,
			"frameFormat", frameFormat,
		)

		metricFrames, err := s.converter.Convert(body, frameFormat)
		if err != nil {
			logger.Error("Error converting metrics", "error", err, "frameFormat", frameFormat)
			continue
		}

		for _, mf := range metricFrames {
			err := stream.Push(mf.Key(), mf.Frame(), stableSchema)
			if err != nil {
				return
			}
		}
	}
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
	return NewDemultiplexer(namespace, g.ManagedStreamRunner), nil
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

// IsEnabled returns true if the Grafana Live feature is enabled.
func (g *GrafanaLive) IsEnabled() bool {
	return g.Cfg.IsLiveEnabled()
}

func (g *GrafanaLive) HandleHTTPPublish(ctx *models.ReqContext, cmd dtos.LivePublishCmd) response.Response {
	addr := live.ParseChannel(cmd.Channel)
	if !addr.IsValid() {
		return response.Error(http.StatusBadRequest, "Bad channel address", nil)
	}

	logger.Debug("Publish API cmd", "user", ctx.SignedInUser.UserId, "cmd", cmd)

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
