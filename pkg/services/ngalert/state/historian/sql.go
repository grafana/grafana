package historian

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
)

type SqlBackend struct {
	log log.Logger
}

func NewSqlBackend() *SqlBackend {
	return &SqlBackend{
		log: log.New("ngalert.state.historian"),
	}
}

func (h *SqlBackend) Record(ctx context.Context, _ history_model.RuleMeta, _ []state.StateTransition) <-chan error {
	errCh := make(chan error)
	close(errCh)
	return errCh
}

func (h *SqlBackend) Query(ctx context.Context, query models.HistoryQuery) (*data.Frame, error) {
	return data.NewFrame("states"), nil
}
