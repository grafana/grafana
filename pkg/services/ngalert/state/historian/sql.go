package historian

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
)

type SqlBackend struct {
	log log.Logger
}

func NewSqlBackend() *SqlBackend {
	return &SqlBackend{
		log: log.New("ngalert.state.historian"),
	}
}

func (h *SqlBackend) RecordStatesAsync(ctx context.Context, _ *models.AlertRule, _ []state.StateTransition) {
}
