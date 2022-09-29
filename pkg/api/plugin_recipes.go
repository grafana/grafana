package api

import (
	"errors"
	"net/http"
	"runtime"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
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
	Id     string           `json:"id"`
	Action string           `json:"action"`
	Meta   RecipeStepMeta   `json:"meta"`
	Plugin RecipeStepPlugin `json:"plugin"`
	Status RecipeStepStatus `json:"status"`
}

type RecipeStepStatus struct {
	Id            string `json:"id"`
	Status        string `json:"status"`
	StatusMessage string `json:"statusMessage"`
}

type InstallResponse struct {
	StatusUrl string `json:"statusUrl"`
	Recipe    Recipe `json:"recipe"`
}

var status = map[string]map[string]RecipeStepStatus{}

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

	if status[recipeID] == nil {
		status[recipeID] = map[string]RecipeStepStatus{}
	}

	for _, step := range recipe.Steps {
		err := hs.pluginInstaller.Add(c.Req.Context(), step.Plugin.Id, step.Plugin.Version, plugins.CompatOpts{
			GrafanaVersion: hs.Cfg.BuildVersion,
			OS:             runtime.GOOS,
			Arch:           runtime.GOARCH,
		})

		if err != nil {

			var dupeErr plugins.DuplicateError
			if errors.As(err, &dupeErr) {
				status[recipeID][step.Id] = RecipeStepStatus{
					Id:            step.Id,
					Status:        "Ok",
					StatusMessage: "Plugin already installed",
				}
			}
			var versionUnsupportedErr repo.ErrVersionUnsupported
			if errors.As(err, &versionUnsupportedErr) {
				status[recipeID][step.Id] = RecipeStepStatus{
					Id:            step.Id,
					Status:        "Error",
					StatusMessage: "Plugin version not supported",
				}
			}
			var versionNotFoundErr repo.ErrVersionNotFound
			if errors.As(err, &versionNotFoundErr) {
				status[recipeID][step.Id] = RecipeStepStatus{
					Id:            step.Id,
					Status:        "Error",
					StatusMessage: "Plugin version not found",
				}
			}
			var clientError repo.Response4xxError
			if errors.As(err, &clientError) {
				status[recipeID][step.Id] = RecipeStepStatus{
					Id:            step.Id,
					Status:        "Error",
					StatusMessage: clientError.Message,
				}
			}
			if errors.Is(err, plugins.ErrInstallCorePlugin) {
				status[recipeID][step.Id] = RecipeStepStatus{
					Id:            step.Id,
					Status:        "Error",
					StatusMessage: "Cannot install or change a Core plugin",
				}
			}

			// Todo: change so we catch other errors

		} else {
			status[recipeID][step.Id] = RecipeStepStatus{
				Id:            step.Id,
				Status:        "Ok",
				StatusMessage: "Plugin successfully installed",
			}
		}

	}

	for i, step := range recipe.Steps {
		recipe.Steps[i].Status = status[recipeID][step.Id]
	}

	return response.JSON(http.StatusOK, InstallResponse{StatusUrl: "/api/plugins-recipe/" + recipe.Id + "/status", Recipe: *recipe})
}

func (hs *HTTPServer) UninstallRecipe(c *models.ReqContext) response.Response {
	return response.Success("Plugin settings updated")
}

func (hs *HTTPServer) GetRecipeStatus(c *models.ReqContext) response.Response {
	recipeID := web.Params(c.Req)[":recipeId"]
	recipe := FindRecipeById(recipes, recipeID)

	for i, step := range recipe.Steps {
		if s, ok := status[recipeID][step.Id]; ok {
			recipe.Steps[i].Status = s
			continue
		}

		_, exists := hs.pluginStore.Plugin(c.Req.Context(), step.Plugin.Id)
		if exists {
			recipe.Steps[i].Status = RecipeStepStatus{
				Id:            step.Id,
				Status:        "Ok",
				StatusMessage: "Plugin successfully installed",
			}
			continue
		}
	}

	return response.JSON(http.StatusOK, InstallResponse{StatusUrl: "/api/plugins-recipe/" + recipe.Id + "/status", Recipe: *recipe})
}

func FindRecipeById(recipes []Recipe, id string) *Recipe {
	for _, recipe := range recipes {
		if recipe.Id == id {
			return &recipe
		}
	}

	return nil
}
