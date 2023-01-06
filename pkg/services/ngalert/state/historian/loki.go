package historian

import (
	"context"

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

func NewRemoteLokiBackend() *RemoteLokiBackend {
	logger := log.New("ngalert.state.historian", "backend", "loki")
	return &RemoteLokiBackend{
		client: newLokiClient(nil, logger),
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
