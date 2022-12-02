package api

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/recipes"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetRecipeList(c *models.ReqContext) response.Response {
	return response.JSON(http.StatusOK, hs.recipeProvider.GetAll())
}

func (hs *HTTPServer) GetRecipeByID(c *models.ReqContext) response.Response {
	recipeID := web.Params(c.Req)[":recipeId"]
	recipe := hs.recipeProvider.GetById(recipeID)

	if recipe == nil {
		return response.Error(http.StatusNotFound, "Plugin recipe not found with the same id", nil)
	}

	return response.JSON(http.StatusOK, recipe)
}

func (hs *HTTPServer) InstallRecipe(c *models.ReqContext) response.Response {
	recipeID := web.Params(c.Req)[":recipeId"]
	recipe := hs.recipeProvider.GetById(recipeID)

	if recipe == nil {
		return response.Error(http.StatusNotFound, "Plugin recipe not found with the same id", nil)
	}

	go func(steps []recipes.RecipeStep, c context.Context) {
		for _, step := range steps {
			step.Apply(c)
		}
	}(recipe.Steps, c.Req.Context())

	return response.JSON(http.StatusOK, recipe)
}

func (hs *HTTPServer) UninstallRecipe(c *models.ReqContext) response.Response {
	recipeID := web.Params(c.Req)[":recipeId"]
	recipe := hs.recipeProvider.GetById(recipeID)

	if recipe == nil {
		return response.Error(http.StatusNotFound, "Plugin recipe not found with the same id", nil)
	}

	go func(steps []recipes.RecipeStep, c context.Context) {
		for _, step := range recipe.Steps {
			step.Revert(c)
		}
	}(recipe.Steps, c.Req.Context())

	return response.JSON(http.StatusOK, recipe)
}
