package api

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/web"
)

type Recipe struct {
	Id          string       `json:"id"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Steps       []RecipeStep `json:"steps"`
}

type RecipeStepMeta struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type RecipeStepPlugin struct {
	Id      string `json:"id"`
	Version string `json:"version"`
}

type RecipeStep struct {
	Action string           `json:"action"`
	Meta   RecipeStepMeta   `json:"meta"`
	Plugin RecipeStepPlugin `json:"plugin"`
}

var recipes = []Recipe{
	{
		Id:          "rcp-zabbix",
		Name:        "Zabbix",
		Description: "Zabbix Plugin reciep",
		Steps: []RecipeStep{
			{
				Action: "install-Plugin",
				Meta: RecipeStepMeta{
					Name:        "",
					Description: "",
				},
				Plugin: RecipeStepPlugin{
					Id:      "alexanderzobnin-zabbix-datasource",
					Version: "",
				},
			},
			{
				Action: "install-Plugin",
				Meta: RecipeStepMeta{
					Name:        "",
					Description: "",
				},
				Plugin: RecipeStepPlugin{
					Id:      "alexanderzobnin-zabbix-triggers-panel",
					Version: "",
				},
			},
			{
				Action: "install-Plugin",
				Meta: RecipeStepMeta{
					Name:        "",
					Description: "",
				},
				Plugin: RecipeStepPlugin{
					Id:      "alexanderzobnin-zabbix-app",
					Version: "",
				},
			},
		},
	},
}

func (hs *HTTPServer) GetRecipeList(c *models.ReqContext) response.Response {
	return response.JSON(http.StatusOK, recipes)
}

func (hs *HTTPServer) GetRecipeByID(c *models.ReqContext) response.Response {
	recipeID := web.Params(c.Req)[":recipeId"]
	recipe := FindRecipeById(recipes, recipeID)

	return response.JSON(http.StatusNotFound, &recipe)
}

func (hs *HTTPServer) InstallRecipe(c *models.ReqContext) response.Response {
	recipeID := web.Params(c.Req)[":recipeId"]
	recipe := FindRecipeById(recipes, recipeID)

	if recipe == nil {
		return response.Error(http.StatusNotFound, "Plugin recipe not found with the same id", nil)
	}

	return response.Success("Plugin settings updated")
}

func (hs *HTTPServer) UninstallRecipe(c *models.ReqContext) response.Response {
	return response.Success("Plugin settings updated")
}

func (hs *HTTPServer) GetRecipeStatus(c *models.ReqContext) response.Response {
	return response.Success("Plugin settings updated")
}

func FindRecipeById(recipes []Recipe, id string) *Recipe {
	for _, recipe := range recipes {
		if recipe.Id == id {
			return &recipe
		}
	}

	return nil
}

// func installRecipe(p *RecipeStep) {
// 	dto := dtos.InstallPluginCommand{}
// 	if err := web.Bind(c.Req, &dto); err != nil {
// 		return response.Error(http.StatusBadRequest, "bad request data", err)
// 	}
// 	pluginID := web.Params(c.Req)[":pluginId"]

// 	err := hs.pluginInstaller.Add(c.Req.Context(), pluginID, dto.Version, plugins.CompatOpts{
// 		GrafanaVersion: hs.Cfg.BuildVersion,
// 		OS:             runtime.GOOS,
// 		Arch:           runtime.GOARCH,
// 	})
// 	if err != nil {
// 		var dupeErr plugins.DuplicateError
// 		if errors.As(err, &dupeErr) {
// 			return response.Error(http.StatusConflict, "Plugin already installed", err)
// 		}
// 		var versionUnsupportedErr repo.ErrVersionUnsupported
// 		if errors.As(err, &versionUnsupportedErr) {
// 			return response.Error(http.StatusConflict, "Plugin version not supported", err)
// 		}
// 		var versionNotFoundErr repo.ErrVersionNotFound
// 		if errors.As(err, &versionNotFoundErr) {
// 			return response.Error(http.StatusNotFound, "Plugin version not found", err)
// 		}
// 		var clientError repo.Response4xxError
// 		if errors.As(err, &clientError) {
// 			return response.Error(clientError.StatusCode, clientError.Message, err)
// 		}
// 		if errors.Is(err, plugins.ErrInstallCorePlugin) {
// 			return response.Error(http.StatusForbidden, "Cannot install or change a Core plugin", err)
// 		}

// 		return response.Error(http.StatusInternalServerError, "Failed to install plugin", err)
// 	}
// }
