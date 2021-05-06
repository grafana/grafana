package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

func (hs *HTTPServer) GetDashboardOrPanelJsonSchema(c *models.ReqContext) response.Response {
	var dsSchema *simplejson.Json
	var err error
	fn := c.Params(":filename")
	dsSchema, err = hs.LoadSchemaService.GetJsonSchema(fn)
	if err != nil {
		return response.Error(500, "Error while get target json schema", err)
	}
	return response.JSON(200, dsSchema)
}
