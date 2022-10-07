package recipes

import (
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

type RecipesProvider interface {
	GetById(id string) (*Recipe, error)
	GetAll() ([]*Recipe, error)
}

type staticRecipesProvider struct {
	recipes []*Recipe
}

func (s *staticRecipesProvider) GetById(id string) (*Recipe, error) {
	return s.recipes[0], nil
}

func (s *staticRecipesProvider) GetAll() ([]*Recipe, error) {
	return s.recipes, nil
}

func ProvideService(i plugins.Installer, cfg *setting.Cfg) RecipesProvider {
	recipes := []*Recipe{
		{
			Id:          "special-mix-of-plugins",
			Name:        "Special mix of plugins",
			Description: "This recipe will contain a special mix of awesome plugins",
			Steps: []RecipeStep{
				NewInstallStep(i, cfg,
					RecipeStepMeta{
						Name:        "Installing Jira",
						Description: "Some description here...",
					}, RecipeStepPlugin{
						Id:      "grafana-jira-datasource",
						Version: "1.0.9",
					},
				),
				NewInstallStep(i, cfg,
					RecipeStepMeta{
						Name:        "Installing K6 app",
						Description: "Some description here...",
					}, RecipeStepPlugin{
						Id:      "grafana-k6-app",
						Version: "0.4.1",
					},
				),
				NewInstallStep(i, cfg,
					RecipeStepMeta{
						Name:        "Installing Anodot panel",
						Description: "Some description here...",
					}, RecipeStepPlugin{
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
