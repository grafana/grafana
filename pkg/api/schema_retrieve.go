package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
)

const defaultPanelSchema = "panel.json"

func (hs *HTTPServer) GetDashboardJsonSchema(c *models.ReqContext) response.Response {
	var dsSchema *simplejson.Json
	var err error

	dsSchema, err = hs.LoadSchemaService.GetJsonSchema("dashboard.json")
	if err != nil {
		return response.Error(500, "Error while get target json schema", err)
	}
	return response.JSON(200, dsSchema)
}

func (hs *HTTPServer) GetPanelJsonSchema(c *models.ReqContext) response.Response {
	var dsSchema *simplejson.Json
	var err error
	pluginid := c.Params(":pluginid")
	dsSchema, err = hs.LoadSchemaService.GetJsonSchema(pluginid + ".json")
	if err != nil {
		dsSchema, err = hs.LoadSchemaService.GetJsonSchema(defaultPanelSchema)
		if err != nil {
			return response.Error(500, "Error while get target json schema", err)
		}
	}
	return response.JSON(200, dsSchema)
}
