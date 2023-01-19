package historian

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

type remoteLokiClient interface {
	ping() error
}

type RemoteLokiBackend struct {
	client remoteLokiClient
	log    log.Logger
}

func NewRemoteLokiBackend(cfg LokiConfig) *RemoteLokiBackend {
	logger := log.New("ngalert.state.historian", "backend", "loki")
	return &RemoteLokiBackend{
		client: newLokiClient(cfg, logger),
		log:    logger,
	}
}

func (h *RemoteLokiBackend) TestConnection() error {
	return h.client.ping()
}

func (h *RemoteLokiBackend) RecordStatesAsync(ctx context.Context, _ *models.AlertRule, _ []state.StateTransition) {
	logger := h.log.FromContext(ctx)
	logger.Debug("Remote Loki state history backend was called with states")
}

func (h *RemoteLokiBackend) QueryStates(ctx context.Context, query models.HistoryQuery) (*data.Frame, error) {
	return data.NewFrame("states"), nil
}
