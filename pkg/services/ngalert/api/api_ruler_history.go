package api

import (
	"context"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type Historian interface {
	QueryStates(ctx context.Context, query models.HistoryQuery) (*data.Frame, error)
}

type HistorySrv struct {
	logger log.Logger
	hist   Historian
}

func (srv *HistorySrv) RouteQueryStateHistory(c *contextmodel.ReqContext) response.Response {
	from := c.QueryInt64("from")
	to := c.QueryInt64("to")
	query := models.HistoryQuery{
		RuleUID:      c.Query("ruleUID"),
		OrgID:        c.OrgID,
		SignedInUser: c.SignedInUser,
		From:         time.Unix(from, 0),
		To:           time.Unix(to, 0),
		Labels:       map[string]string{}, // TODO, not supported by all backends yet.
	}
	frame, err := srv.hist.QueryStates(c.Req.Context(), query)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, frame)
}
