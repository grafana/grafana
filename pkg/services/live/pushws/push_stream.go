package pushws

import (
	"net/http"

	"github.com/gorilla/websocket"
	liveDto "github.com/grafana/grafana-plugin-sdk-go/live"

	"github.com/grafana/grafana/pkg/services/live/convert"
	"github.com/grafana/grafana/pkg/services/live/livecontext"
	"github.com/grafana/grafana/pkg/services/live/managedstream"
	"github.com/grafana/grafana/pkg/services/live/pushurl"
)

// Handler handles WebSocket client connections that push data to Live.
type Handler struct {
	managedStreamRunner *managedstream.Runner
	config              Config
	upgrade             *websocket.Upgrader
	converter           *convert.Converter
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

func (s *Handler) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
	streamID, ok := livecontext.GetContextStreamID(r.Context())
	if !ok || streamID == "" {
		logger.Warn("Push request without stream ID")
		rw.WriteHeader(http.StatusInternalServerError)
		return
	}

	user, ok := livecontext.GetContextSignedUser(r.Context())
	if !ok {
		logger.Error("No user found in context")
		rw.WriteHeader(http.StatusInternalServerError)
		return
	}

	conn, err := s.upgrade.Upgrade(rw, r, nil)
	if err != nil {
		return
	}
	defer func() { _ = conn.Close() }()
	setupWSConn(r.Context(), conn, s.config)

	for {
		_, body, err := conn.ReadMessage()
		if err != nil {
			logger.Debug("Error reading websocket connection", "error", err)
			break
		}

		stream, err := s.managedStreamRunner.GetOrCreateStream(user.OrgID, liveDto.ScopeStream, streamID)
		if err != nil {
			logger.Error("Error getting stream", "error", err)
			continue
		}

		// TODO Grafana 8: decide which formats to use or keep all.
		urlValues := r.URL.Query()
		frameFormat := pushurl.FrameFormatFromValues(urlValues)

		logger.Debug("Live Push request",
			"protocol", "http",
			"streamId", streamID,
			"bodyLength", len(body),
			"frameFormat", frameFormat,
		)

		metricFrames, err := s.converter.Convert(body, frameFormat)
		if err != nil {
			logger.Error("Error converting metrics", "error", err, "frameFormat", frameFormat)
			continue
		}

		for _, mf := range metricFrames {
			err := stream.Push(r.Context(), mf.Key(), mf.Frame())
			if err != nil {
				logger.Error("Error pushing frame", "error", err, "data", string(body))
				return
			}
		}
	}
}
