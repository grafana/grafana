package api

import (
	"context"
	"net/http"

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
	query := models.HistoryQuery{
		RuleUID:      c.Query("ruleUID"),
		OrgID:        c.OrgID,
		SignedInUser: c.SignedInUser,
	}
	frame, err := srv.hist.QueryStates(c.Req.Context(), query)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, frame)
}
