package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	gapi "github.com/grafana/grafana/pkg/models"
)

type HistorySrv struct {
	logger log.Logger
}

func (srv *HistorySrv) RouteQueryStateHistory(c *gapi.ReqContext) response.Response {
	return response.Empty(http.StatusInternalServerError)
}
