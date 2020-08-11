package live

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/centrifugal/centrifuge"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

var (
	logger   = log.New("live")
	loggerCF = log.New("live.centrifuge")
)

// GrafanaLive pretends to be the server
type GrafanaLive struct {
	node    *centrifuge.Node
	Handler interface{} // handler func
}

// InitalizeBroker initializes the broker and starts listening for requests.
func InitalizeBroker() (*GrafanaLive, error) {
	// We use default config here as starting point. Default config contains
	// reasonable values for available options.
	cfg := centrifuge.DefaultConfig

	// cfg.LogLevel = centrifuge.LogLevelDebug
	cfg.LogHandler = handleLog

	// Node is the core object in Centrifuge library responsible for many useful
	// things. For example Node allows to publish messages to channels from server
	// side with its Publish method, but in this example we will publish messages
	// only from client side.
	node, err := centrifuge.New(cfg)
	if err != nil {
		return nil, err
	}

	b := &GrafanaLive{
		node: node,
	}

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

	// Set SubscribeHandler to react on every channel subscription attempt
	// initiated by client. Here you can theoretically return an error or
	// disconnect client from server if needed. But now we just accept
	// all subscriptions to all channels. In real life you may use a more
	// complex permission check here.
	node.OnSubscribe(func(c *centrifuge.Client, e centrifuge.SubscribeEvent) (centrifuge.SubscribeReply, error) {
		info := &channelInfo{
			Description: fmt.Sprintf("channel: %s", e.Channel),
		}
		bytes, err := json.Marshal(&info)
		if err != nil {
			return centrifuge.SubscribeReply{}, err
		}
		logger.Debug("client subscribes on channel", "channel", e.Channel, "info", string(bytes))

		return centrifuge.SubscribeReply{
			ExpireAt:    0, // does not expire
			ChannelInfo: bytes,
		}, nil
	})

	node.OnUnsubscribe(func(c *centrifuge.Client, e centrifuge.UnsubscribeEvent) {
		s, err := node.PresenceStats(e.Channel)
		if err != nil {
			logger.Warn("unable to get presence stats", "channel", e.Channel, "error", err)
		}
		logger.Debug("unsubscribe from channel", "channel", e.Channel, "clients", s.NumClients, "users", s.NumUsers)
	})

	// By default, clients can not publish messages into channels. By setting
	// PublishHandler we tell Centrifuge that publish from client side is possible.
	// Now each time client calls publish method this handler will be called and
	// you have a possibility to validate publication request before message will
	// be published into channel and reach active subscribers. In our simple chat
	// app we allow everyone to publish into any channel.
	node.OnPublish(func(c *centrifuge.Client, e centrifuge.PublishEvent) (centrifuge.PublishReply, error) {
		// logger.Debug("client publishes into channel", "channel", e.Channel, "body", string(e.Data))

		// For now, broadcast any messages to everyone
		_, err := node.Publish(e.Channel, e.Data)
		return centrifuge.PublishReply{}, err // returns an error if it could not publish
	})

	// Set Disconnect handler to react on client disconnect events.
	node.OnDisconnect(func(c *centrifuge.Client, e centrifuge.DisconnectEvent) {
		logger.Info("client disconnected")
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

	b.Handler = func(ctx *models.ReqContext) {
		// Put authentication Credentials into request Context. Since we don't
		// have any session backend here we simply set user ID as empty string.
		// Users with empty ID called anonymous users, in real app you should
		// decide whether anonymous users allowed to connect to your server
		// or not. There is also another way to set Credentials - returning them
		// from ConnectingHandler which is called after client sent first command
		// to server called Connect. See _examples folder in repo to find real-life
		// auth samples (OAuth2, Gin sessions, JWT etc).
		cred := &centrifuge.Credentials{
			UserID: "",
		}
		newCtx := centrifuge.SetCredentials(ctx.Req.Context(), cred)

		path := ctx.Req.URL.Path
		logger.Debug("Handle", "path", path)

		r := ctx.Req.Request
		r = r.WithContext(newCtx) // Set a user ID

		// Check if this is a direct websocket connection
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
	return b, nil
}

// Publish sends the data to the channel
func (b *GrafanaLive) Publish(channel string, data []byte) bool {
	_, err := b.node.Publish(channel, data)
	if err != nil {
		logger.Warn("error writing to channel", "channel", channel, "err", err)
	}
	return err == nil
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
