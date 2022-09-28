package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetRecipeList(c *models.ReqContext) response.Response {
	result := 0
	return response.JSON(http.StatusOK, result)
}

func (hs *HTTPServer) GetRecipeByID(c *models.ReqContext) response.Response {
	recipeID := web.Params(c.Req)[":recipeId"]
	return response.JSON(http.StatusOK, recipeID)
}

func (hs *HTTPServer) InstallRecipe(c *models.ReqContext) response.Response {
	return response.Success("Plugin settings updated")
}

func (hs *HTTPServer) UninstallRecipe(c *models.ReqContext) response.Response {
	return response.Success("Plugin settings updated")
}

func (hs *HTTPServer) GetRecipeStatus(c *models.ReqContext) response.Response {
	return response.Success("Plugin settings updated")
}
