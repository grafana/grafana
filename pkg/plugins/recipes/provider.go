package recipes

import (
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

type RecipesProvider interface {
	GetById(id string) *Recipe
	GetAll() []*Recipe
}

type staticRecipesProvider struct {
	recipes []*Recipe
}

func (s *staticRecipesProvider) GetById(id string) *Recipe {
	for _, recipe := range s.recipes {
		if recipe.Id == id {
			return recipe
		}
	}
	return nil
}

func (s *staticRecipesProvider) GetAll() []*Recipe {
	return s.recipes
}

func ProvideService(i plugins.Installer, cfg *setting.Cfg) RecipesProvider {
	recipes := []*Recipe{
		{
			Id:   "special-mix-of-plugins",
			Name: "Special mix of plugins",
			Meta: RecipeMeta{
				Summary:     "This recipe will contain a special mix of awesome plugins",
				Description: "",
			},
			Steps: []RecipeStep{
				newInstallStep(i, cfg,
					RecipeStepMeta{
						Name:        "Installing Jira",
						Description: "Some description here...",
					}, recipePluginStep{
						Id:      "grafana-jira-datasource",
						Version: "1.0.9",
					},
				),
				newInstallStep(i, cfg,
					RecipeStepMeta{
						Name:        "Installing K6 app",
						Description: "Some description here...",
					}, recipePluginStep{
						Id:      "grafana-k6-app",
						Version: "0.4.1",
					},
				),
				newInstallStep(i, cfg,
					RecipeStepMeta{
						Name:        "Installing Anodot panel",
						Description: "Some description here...",
					}, recipePluginStep{
						Id:      "anodot-panel",
						Version: "2.0.1",
					},
				),
			},
		},
	}

	return &staticRecipesProvider{
		recipes: recipes,
	}
}
