package api

import (
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/recipes"
	"github.com/grafana/grafana/pkg/web"
)

func (hs *HTTPServer) GetRecipeList(c *models.ReqContext) response.Response {
	rs := hs.recipeProvider.GetAll()
	dtos := make([]*recipes.RecipeDTO, len(rs))

	for i, r := range rs {
		dtos[i] = r.ToDto(c)
	}

	return response.JSON(http.StatusOK, dtos)
}

func (hs *HTTPServer) GetRecipeByID(c *models.ReqContext) response.Response {
	recipeID := web.Params(c.Req)[":recipeId"]
	recipe := hs.recipeProvider.GetById(recipeID)

	if recipe == nil {
		return response.Error(http.StatusNotFound, "Plugin recipe not found with the same id", nil)
	}

	return response.JSON(http.StatusOK, recipe.ToDto(c))
}

func (hs *HTTPServer) InstallRecipe(c *models.ReqContext) response.Response {
	recipeID := web.Params(c.Req)[":recipeId"]
	recipe := hs.recipeProvider.GetById(recipeID)

	if recipe == nil {
		return response.Error(http.StatusNotFound, "Plugin recipe not found with the same id", nil)
	}

	recipe.IsInstallStarted = true

	go func(steps []recipes.RecipeStep, c *models.ReqContext) {
		for _, step := range steps {
			step.Apply(c)
		}
	}(recipe.Steps, c)

	return response.JSON(http.StatusOK, recipe.ToDto(c))
}

func (hs *HTTPServer) UninstallRecipe(c *models.ReqContext) response.Response {
	recipeID := web.Params(c.Req)[":recipeId"]
	recipe := hs.recipeProvider.GetById(recipeID)

	if recipe == nil {
		return response.Error(http.StatusNotFound, "Plugin recipe not found with the same id", nil)
	}

	// TODO: Only an edge-case, we don't need to handle it now, but: what if a plugin was already installed in Grafana before we installed the recipe? Are we going to uninstall it now? If yes, is that going to break anything for the user (other dashboards, datasources, etc.)?
	go func(steps []recipes.RecipeStep, c *models.ReqContext) {
		for _, step := range recipe.Steps {
			step.Revert(c)
		}
	}(recipe.Steps, c)

	recipe.IsInstallStarted = false

	return response.JSON(http.StatusOK, recipe.ToDto(c))
}

func (hs *HTTPServer) ApplyRecipeStep(c *models.ReqContext) response.Response {
	recipeID := web.Params(c.Req)[":recipeId"]
	rawStepNumber := web.Params(c.Req)[":stepNumber"]

	stepNumber, err := strconv.Atoi(rawStepNumber)
	if err != nil {
		return response.Error(http.StatusBadRequest, "The step number needs to be a number, received: '"+rawStepNumber+"'", nil)
	}

	recipe := hs.recipeProvider.GetById(recipeID)
	if recipe == nil {
		return response.Error(http.StatusNotFound, "Plugin recipe not found with ID '"+recipeID+"'", nil)
	}
	recipe.IsInstallStarted = true

	step := recipe.Steps[stepNumber]
	step.Apply(c)

	return response.JSON(http.StatusOK, step.ToDto(c))
}

func (hs *HTTPServer) RevertRecipeStep(c *models.ReqContext) response.Response {
	recipeID := web.Params(c.Req)[":recipeId"]
	rawStepNumber := web.Params(c.Req)[":stepNumber"]

	stepNumber, err := strconv.Atoi(rawStepNumber)
	if err != nil {
		return response.Error(http.StatusBadRequest, "The step number needs to be a number, received: '"+rawStepNumber+"'", nil)
	}

	recipe := hs.recipeProvider.GetById(recipeID)
	if recipe == nil {
		return response.Error(http.StatusNotFound, "Plugin recipe not found with ID '"+recipeID+"'", nil)
	}

	step := recipe.Steps[stepNumber]
	step.Revert(c)

	// TODO: check if this has been the last completed step, and if yes, mark the recipe as not installed (Recipe.IsInstallStarted)

	return response.JSON(http.StatusOK, step.ToDto(c))
}
