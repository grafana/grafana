package pushws

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gorilla/websocket"

	"github.com/grafana/grafana/pkg/infra/log"
)

var (
	logger = log.New("live.push_ws")
)

// Config represents config for Handler.
type Config struct {
	// ReadBufferSize is a parameter that is used for raw websocket Upgrader.
	// If set to zero reasonable default value will be used.
	ReadBufferSize int

	// WriteBufferSize is a parameter that is used for raw websocket Upgrader.
	// If set to zero reasonable default value will be used.
	WriteBufferSize int

	// MessageSizeLimit sets the maximum size in bytes of allowed message from client.
	// By default DefaultWebsocketMessageSizeLimit will be used.
	MessageSizeLimit int

	// CheckOrigin func to provide custom origin check logic,
	// zero value means same host check.
	CheckOrigin func(r *http.Request) bool

	// PingInterval sets interval server will send ping messages to clients.
	// By default DefaultWebsocketPingInterval will be used.
	PingInterval time.Duration
}

func sameHostOriginCheck() func(r *http.Request) bool {
	return func(r *http.Request) bool {
		err := checkSameHost(r)
		if err != nil {
			logger.Warn("Origin check failure", "origin", r.Header.Get("origin"), "error", err)
			return false
		}
		return true
	}
}

func checkSameHost(r *http.Request) error {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return nil
	}
	u, err := url.Parse(origin)
	if err != nil {
		return fmt.Errorf("failed to parse Origin header %q: %w", origin, err)
	}
	if strings.EqualFold(r.Host, u.Host) {
		return nil
	}
	return fmt.Errorf("request Origin %q is not authorized for Host %q", origin, r.Host)
}

// Defaults.
const (
	DefaultWebsocketPingInterval     = 25 * time.Second
	DefaultWebsocketMessageSizeLimit = 1024 * 1024 // 1MB
)

func setupWSConn(ctx context.Context, conn *websocket.Conn, config Config) {
	pingInterval := config.PingInterval
	if pingInterval == 0 {
		pingInterval = DefaultWebsocketPingInterval
	}
	messageSizeLimit := config.MessageSizeLimit
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

	go func() {
		ticker := time.NewTicker(25 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
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
}
