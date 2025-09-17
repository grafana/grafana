package api

import (
	"net/http"
	"slices"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/channels_config"
)

func (hs *HTTPServer) GetAlertNotifiers() func(*contextmodel.ReqContext) response.Response {
	return func(r *contextmodel.ReqContext) response.Response {
		if r.Query("version") == "2" {
			return response.JSON(http.StatusOK, slices.Collect(channels_config.GetAvailableNotifiersV2()))
		}
		return response.JSON(http.StatusOK, channels_config.GetAvailableNotifiers())
	}
}
