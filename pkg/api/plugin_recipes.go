package api

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/recipes"
	"github.com/grafana/grafana/pkg/web"
)

type InstallResponse struct {
	StatusUrl string         `json:"statusUrl"`
	Recipe    recipes.Recipe `json:"recipe"`
}

func (hs *HTTPServer) GetRecipeList(c *models.ReqContext) response.Response {
	rs, err := hs.recipeProvider.GetAll()
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Unexpected error occured when fetching recipes", nil)
	}
	return response.JSON(http.StatusOK, rs)
}

func (hs *HTTPServer) GetRecipeByID(c *models.ReqContext) response.Response {
	recipeID := web.Params(c.Req)[":recipeId"]
	recipe, err := hs.recipeProvider.GetById(recipeID)

	if err != nil {
		return response.Error(http.StatusNotFound, "Plugin recipe not found with the same id", nil)
	}

	return response.JSON(http.StatusNotFound, recipe)
}

func (hs *HTTPServer) InstallRecipe(c *models.ReqContext) response.Response {
	recipeID := web.Params(c.Req)[":recipeId"]
	recipe, err := hs.recipeProvider.GetById(recipeID)

	if err != nil {
		return response.Error(http.StatusNotFound, "Plugin recipe not found with the same id", nil)
	}

	go func(steps []recipes.RecipeStep, c context.Context) {
		for _, step := range steps {
			step.Apply(&c)
		}
	}(recipe.Steps, c.Req.Context())

	return response.JSON(http.StatusOK, recipe)
}

func (hs *HTTPServer) UninstallRecipe(c *models.ReqContext) response.Response {
	recipeID := web.Params(c.Req)[":recipeId"]
	recipe, err := hs.recipeProvider.GetById(recipeID)

	if err != nil {
		return response.Error(http.StatusNotFound, "Plugin recipe not found with the same id", nil)
	}

	go func(steps []recipes.RecipeStep, c context.Context) {
		for _, step := range recipe.Steps {
			step.Revert(&c)
		}
	}(recipe.Steps, c.Req.Context())

	return response.JSON(http.StatusOK, recipe)
}

func (hs *HTTPServer) GetRecipeStatus(c *models.ReqContext) response.Response {
	recipeID := web.Params(c.Req)[":recipeId"]
	recipe, err := hs.recipeProvider.GetById(recipeID)

	if err != nil {
		return response.Error(http.StatusNotFound, "Plugin recipe not found with the same id", nil)
	}

	// for i, step := range recipe.Steps {
	// 	_, exists := hs.pluginStore.Plugin(c.Req.Context(), step.Plugin.Id)
	// 	if exists {
	// 		recipe.Steps[i].Status = RecipeStepStatus{
	// 			Id:            step.Id,
	// 			Status:        "Installed",
	// 			StatusMessage: "Plugin successfully installed",
	// 		}
	// 		continue
	// 	}
	// }

	return response.JSON(http.StatusOK, recipe.Steps)
}
