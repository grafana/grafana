package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

type HistorySrv struct {
	logger log.Logger
}

func (srv *HistorySrv) RouteQueryStateHistory(c *contextmodel.ReqContext) response.Response {
	return response.Empty(http.StatusInternalServerError)
}
