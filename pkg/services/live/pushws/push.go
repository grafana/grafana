package pushws

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/live/convert"
	"github.com/grafana/grafana/pkg/services/live/managedstream"
	"github.com/grafana/grafana/pkg/services/live/pushurl"

	"github.com/gorilla/websocket"
)

var (
	logger = log.New("live.push_ws")
)

// Handler handles WebSocket client connections that push data to Live.
type Handler struct {
	managedStreamRunner *managedstream.Runner
	config              Config
	upgrade             *websocket.Upgrader
	converter           *convert.Converter
}

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

// NewHandler creates new Handler.
func NewHandler(managedStreamRunner *managedstream.Runner, c Config) *Handler {
	if c.CheckOrigin == nil {
		c.CheckOrigin = sameHostOriginCheck()
	}
	upgrade := &websocket.Upgrader{
		ReadBufferSize:  c.ReadBufferSize,
		WriteBufferSize: c.WriteBufferSize,
		CheckOrigin:     c.CheckOrigin,
	}
	return &Handler{
		managedStreamRunner: managedStreamRunner,
		config:              c,
		upgrade:             upgrade,
		converter:           convert.NewConverter(),
	}
}

func sameHostOriginCheck() func(r *http.Request) bool {
	return func(r *http.Request) bool {
		err := checkSameHost(r)
		if err != nil {
			log.Warn("Origin check failure", "origin", r.Header.Get("origin"), "error", err)
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

func (s *Handler) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
	var streamID string

	streamID = r.Header.Get("X-Grafana-Live-Stream")
	if streamID == "" {
		streamID = r.URL.Query().Get("gf_live_stream")
	}
	if streamID == "" {
		logger.Warn("Push request without stream ID")
		rw.WriteHeader(http.StatusBadRequest)
		return
	}

	conn, err := s.upgrade.Upgrade(rw, r, nil)
	if err != nil {
		return
	}

	pingInterval := s.config.PingInterval
	if pingInterval == 0 {
		pingInterval = DefaultWebsocketPingInterval
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

		stream, err := s.managedStreamRunner.GetOrCreateStream(streamID)
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
