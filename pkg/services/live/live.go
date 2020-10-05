package live

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/live/features"
)

var (
	logger   = log.New("live")
	loggerCF = log.New("live.centrifuge")
)

// CoreGrafanaScope list of core features
type CoreGrafanaScope struct {
	Features map[string]models.ChannelHandlerProvider

	// The generic service to advertise dashboard changes
	Dashboards models.DashboardActivityChannel
}

// GrafanaLive pretends to be the server
type GrafanaLive struct {
	node *centrifuge.Node

	// The websocket handler
	Handler interface{}

	// Full channel handler
	channels   map[string]models.ChannelHandler
	channelsMu sync.RWMutex

	// The core internal features
	GrafanaScope CoreGrafanaScope
}

// InitializeBroker initializes the broker and starts listening for requests.
func InitializeBroker() (*GrafanaLive, error) {
	glive := &GrafanaLive{
		channels:   make(map[string]models.ChannelHandler),
		channelsMu: sync.RWMutex{},
		GrafanaScope: CoreGrafanaScope{
			Features: make(map[string]models.ChannelHandlerProvider),
		},
	}

	// We use default config here as starting point. Default config contains
	// reasonable values for available options.
	cfg := centrifuge.DefaultConfig

	// cfg.LogLevel = centrifuge.LogLevelDebug
	cfg.LogHandler = handleLog

	// This function is called fast and often -- it must be sychronized
	cfg.ChannelOptionsFunc = func(channel string) (centrifuge.ChannelOptions, bool, error) {
		handler, err := glive.GetChannelHandler(channel)
		if err != nil {
			logger.Error("ChannelOptionsFunc", "channel", channel, "err", err)
			if err.Error() == "404" { // ????
				return centrifuge.ChannelOptions{}, false, nil
			}
			return centrifuge.ChannelOptions{}, true, err
		}
		opts := handler.GetChannelOptions(channel)
		return opts, true, nil
	}

	// Node is the core object in Centrifuge library responsible for many useful
	// things. For example Node allows to publish messages to channels from server
	// side with its Publish method, but in this example we will publish messages
	// only from client side.
	node, err := centrifuge.New(cfg)
	if err != nil {
		return nil, err
	}
	glive.node = node

	// Initialize the main features
	dash := features.CreateDashboardHandler(glive.Publish)
	tds := features.CreateTestdataSupplier(glive.Publish)

	glive.GrafanaScope.Dashboards = &dash
	glive.GrafanaScope.Features["dashboard"] = &dash
	glive.GrafanaScope.Features["testdata"] = &tds
	glive.GrafanaScope.Features["broadcast"] = &features.BroadcastRunner{}

	// Set ConnectHandler called when client successfully connected to Node. Your code
	// inside handler must be synchronized since it will be called concurrently from
	// different goroutines (belonging to different client connections). This is also
	// true for other event handlers.
	node.OnConnect(func(c *centrifuge.Client) {
		// In our example transport will always be Websocket but it can also be SockJS.
		transportName := c.Transport().Name()

		// In our example clients connect with JSON protocol but it can also be Protobuf.
		transportEncoding := c.Transport().Encoding()
		logger.Debug("client connected", "transport", transportName, "encoding", transportEncoding)
	})

	// Set Disconnect handler to react on client disconnect events.
	node.OnDisconnect(func(c *centrifuge.Client, e centrifuge.DisconnectEvent) {
		logger.Info("client disconnected")
	})

	// Set SubscribeHandler to react on every channel subscription attempt
	// initiated by client. Here you can theoretically return an error or
	// disconnect client from server if needed. But now we just accept
	// all subscriptions to all channels. In real life you may use a more
	// complex permission check here.
	node.OnSubscribe(func(c *centrifuge.Client, e centrifuge.SubscribeEvent) (centrifuge.SubscribeReply, error) {
		reply := centrifuge.SubscribeReply{}

		handler, err := glive.GetChannelHandler(e.Channel)
		if err != nil {
			return reply, err
		}

		err = handler.OnSubscribe(c, e)
		if err != nil {
			return reply, err
		}

		return reply, nil
	})

	node.OnUnsubscribe(func(c *centrifuge.Client, e centrifuge.UnsubscribeEvent) {
		logger.Debug("unsubscribe from channel", "channel", e.Channel, "user", c.UserID())
	})

	// Called when something is written to the websocket
	node.OnPublish(func(c *centrifuge.Client, e centrifuge.PublishEvent) (centrifuge.PublishReply, error) {
		reply := centrifuge.PublishReply{}
		handler, err := glive.GetChannelHandler(e.Channel)
		if err != nil {
			return reply, err
		}

		data, err := handler.OnPublish(c, e)
		if err != nil {
			return reply, err
		}
		if len(data) > 0 {
			_, err = node.Publish(e.Channel, e.Data)
		}
		return centrifuge.PublishReply{}, err // returns an error if it could not publish
	})

	// Run node. This method does not block.
	if err := node.Run(); err != nil {
		return nil, err
	}

	// SockJS will find the best protocol possible for the browser
	sockJsPrefix := "/live/sockjs"
	sockjsHandler := centrifuge.NewSockjsHandler(node, centrifuge.SockjsConfig{
		HandlerPrefix:            sockJsPrefix,
		WebsocketReadBufferSize:  1024,
		WebsocketWriteBufferSize: 1024,
	})

	// Use a direct websocket from go clients
	wsHandler := centrifuge.NewWebsocketHandler(node, centrifuge.WebsocketConfig{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	})

	glive.Handler = func(ctx *models.ReqContext) {
		user := ctx.SignedInUser
		if user == nil {
			ctx.Resp.WriteHeader(401)
			return
		}

		dto := models.UserProfileDTO{
			Id:             user.UserId,
			Name:           user.Name,
			Email:          user.Email,
			Login:          user.Login,
			IsGrafanaAdmin: user.IsGrafanaAdmin,
			OrgId:          user.OrgId,
		}

		jsonData, err := json.Marshal(dto)
		if err != nil {
			logger.Debug("error reading user", "dto", dto)
			ctx.Resp.WriteHeader(404)
			return
		}
		logger.Info("Logged in user", "user", user)

		cred := &centrifuge.Credentials{
			UserID: fmt.Sprintf("%d", user.UserId),
			Info:   jsonData,
		}
		newCtx := centrifuge.SetCredentials(ctx.Req.Context(), cred)

		r := ctx.Req.Request
		r = r.WithContext(newCtx) // Set a user ID

		// Check if this is a direct websocket connection
		path := ctx.Req.URL.Path
		if strings.Contains(path, "live/ws") {
			wsHandler.ServeHTTP(ctx.Resp, r)
			return
		}

		if strings.Contains(path, sockJsPrefix) {
			sockjsHandler.ServeHTTP(ctx.Resp, r)
			return
		}

		// Unknown path
		ctx.Resp.WriteHeader(404)
	}
	return glive, nil
}

// GetChannelHandler gives threadsafe access to the channel
func (g *GrafanaLive) GetChannelHandler(channel string) (models.ChannelHandler, error) {
	g.channelsMu.RLock()
	c, ok := g.channels[channel]
	g.channelsMu.RUnlock() // defer? but then you can't lock further down
	if ok {
		return c, nil
	}

	// Parse the identifier ${scope}/${namespace}/${path}
	id, err := ParseChannelIdentifier(channel)
	if err != nil {
		return nil, err
	}
	logger.Info("initChannel", "channel", channel, "id", id)

	g.channelsMu.Lock()
	defer g.channelsMu.Unlock()
	c, ok = g.channels[channel] // may have filled in while locked
	if ok {
		return c, nil
	}

	c, err = g.initChannel(id)
	if err != nil {
		return nil, err
	}
	g.channels[channel] = c
	return c, nil
}

func (g *GrafanaLive) initChannel(id ChannelIdentifier) (models.ChannelHandler, error) {
	if id.Scope == "grafana" {
		p, ok := g.GrafanaScope.Features[id.Namespace]
		if ok {
			return p.GetHandlerForPath(id.Path)
		}
		return nil, fmt.Errorf("Unknown feature: %s", id.Namespace)
	}

	if id.Scope == "ds" {
		return nil, fmt.Errorf("todo... look up datasource: %s", id.Namespace)
	}

	if id.Scope == "plugin" {
		p, ok := plugins.Plugins[id.Namespace]
		if ok {
			h := &PluginHandler{
				Plugin: p,
			}
			return h.GetHandlerForPath(id.Path)
		}
		return nil, fmt.Errorf("unknown plugin: %s", id.Namespace)
	}

	return nil, fmt.Errorf("invalid scope: %s", id.Scope)
}

// Publish sends the data to the channel without checking permissions etc
func (g *GrafanaLive) Publish(channel string, data []byte) error {
	_, err := g.node.Publish(channel, data)
	return err
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
	}
}
