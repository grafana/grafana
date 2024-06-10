package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels_config"
)

func (hs *HTTPServer) GetAlertNotifiers() func(*contextmodel.ReqContext) response.Response {
	return func(_ *contextmodel.ReqContext) response.Response {
		return response.JSON(http.StatusOK, channels_config.GetAvailableNotifiers())
	}
}
