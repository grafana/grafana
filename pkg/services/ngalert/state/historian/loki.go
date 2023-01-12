package historian

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

type RemoteLokiBackend struct {
	log log.Logger
}

func NewRemoteLokiBackend() *RemoteLokiBackend {
	return &RemoteLokiBackend{
		log: log.New("ngalert.state.historian"),
	}
}

func (h *RemoteLokiBackend) RecordStatesAsync(ctx context.Context, _ *models.AlertRule, _ []state.StateTransition) {
}
