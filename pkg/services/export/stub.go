package export

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/contexthandler/model"
)

var _ ExportService = new(StubExport)

type StubExport struct{}

func (ex *StubExport) HandleGetStatus(c *model.ReqContext) response.Response {
	return response.Error(http.StatusForbidden, "feature not enabled", nil)
}

func (ex *StubExport) HandleGetOptions(c *model.ReqContext) response.Response {
	return response.Error(http.StatusForbidden, "feature not enabled", nil)
}

func (ex *StubExport) HandleRequestExport(c *model.ReqContext) response.Response {
	return response.Error(http.StatusForbidden, "feature not enabled", nil)
}

func (ex *StubExport) HandleRequestStop(c *model.ReqContext) response.Response {
	return response.Error(http.StatusForbidden, "feature not enabled", nil)
}
