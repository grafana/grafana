package export

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

var _ ExportService = new(StubExport)

type StubExport struct{}

func (ex *StubExport) HandleGetStatus(c *contextmodel.ReqContext) response.Response {
	return response.Error(http.StatusForbidden, "feature not enabled", nil)
}

func (ex *StubExport) HandleGetOptions(c *contextmodel.ReqContext) response.Response {
	return response.Error(http.StatusForbidden, "feature not enabled", nil)
}

func (ex *StubExport) HandleRequestExport(c *contextmodel.ReqContext) response.Response {
	return response.Error(http.StatusForbidden, "feature not enabled", nil)
}

func (ex *StubExport) HandleRequestStop(c *contextmodel.ReqContext) response.Response {
	return response.Error(http.StatusForbidden, "feature not enabled", nil)
}
