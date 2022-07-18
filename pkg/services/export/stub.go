package export

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
)

var _ ExportService = new(StubExport)

type StubExport struct{}

func (ex *StubExport) HandleGetStatus(c *models.ReqContext) response.Response {
	return response.Error(http.StatusForbidden, "feature not enabled", nil)
}

func (ex *StubExport) HandleGetOptions(c *models.ReqContext) response.Response {
	return response.Error(http.StatusForbidden, "feature not enabled", nil)
}

func (ex *StubExport) HandleRequestExport(c *models.ReqContext) response.Response {
	return response.Error(http.StatusForbidden, "feature not enabled", nil)
}

func (ex *StubExport) HandleRequestStop(c *models.ReqContext) response.Response {
	return response.Error(http.StatusForbidden, "feature not enabled", nil)
}
