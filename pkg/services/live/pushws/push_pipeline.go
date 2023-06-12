package pushws

import (
	"net/http"

	"github.com/gorilla/websocket"

	"github.com/grafana/grafana/pkg/services/live/convert"
	"github.com/grafana/grafana/pkg/services/live/livecontext"
	"github.com/grafana/grafana/pkg/services/live/pipeline"
)

// PipelinePushHandler handles WebSocket client connections that push data to Live Pipeline.
type PipelinePushHandler struct {
	pipeline  *pipeline.Pipeline
	config    Config
	upgrade   *websocket.Upgrader
	converter *convert.Converter
}

// NewPathHandler creates new PipelinePushHandler.
func NewPipelinePushHandler(pipeline *pipeline.Pipeline, c Config) *PipelinePushHandler {
	if c.CheckOrigin == nil {
		c.CheckOrigin = sameHostOriginCheck()
	}
	upgrade := &websocket.Upgrader{
		ReadBufferSize:  c.ReadBufferSize,
		WriteBufferSize: c.WriteBufferSize,
		CheckOrigin:     c.CheckOrigin,
	}
	return &PipelinePushHandler{
		pipeline:  pipeline,
		config:    c,
		upgrade:   upgrade,
		converter: convert.NewConverter(),
	}
}

func (s *PipelinePushHandler) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
	channelID, ok := livecontext.GetContextChannelID(r.Context())
	if !ok || channelID == "" {
		logger.Warn("Push request without channel")
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

		logger.Debug("Live channel push request",
			"protocol", "http",
			"channel", channelID,
			"bodyLength", len(body),
		)

		ruleFound, err := s.pipeline.ProcessInput(r.Context(), user.OrgID, channelID, body)
		if err != nil {
			logger.Error("Pipeline input processing error", "error", err, "body", string(body))
			return
		}
		if !ruleFound {
			logger.Error("No conversion rule for a channel", "error", err, "channel", channelID)
			return
		}
	}
}
