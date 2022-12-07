package recipes

import "github.com/grafana/grafana/pkg/models"

type RecipeStep interface {
	Apply(c *models.ReqContext) error
	Revert(c *models.ReqContext) error
	Status(c *models.ReqContext) (StepStatus, error)
}

type RecipeStepMeta struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type RecipeStepStatus struct {
	Status        string `json:"status"` // "Completed" | "NotComleted" | "Error"
	StatusMessage string `json:"statusMessage"`
}

type RecipeStepScreenshot struct {
	Name string `json:"name"`
	Url  string `json:"url"`
}
