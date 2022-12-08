package recipes

import "github.com/grafana/grafana/pkg/models"

type RecipeMeta struct {
	Summary     string `json:"summary"`
	Description string `json:"description"`
	Logo        string `json:"logo"`
}

type Recipe struct {
	Id               string       `json:"id"`
	Name             string       `json:"name"`
	IsInstallStarted bool         `json:"isInstallStarted"` // We need to perisist if the user has attempted to install this recipe. It is necessary, because certain steps can already be completed (e.g. existing plugin) even if the installation hasn't started yet, and we couldn't show a consistent state on the UI without this information. A recipe is installed when all of its steps are completed.
	Meta             RecipeMeta   `json:"meta"`
	Steps            []RecipeStep `json:"steps"`
}

func (r *Recipe) ToDto(c *models.ReqContext) *RecipeDTO {
	var steps = make([]*RecipeStepDTO, len(r.Steps))

	for i, step := range r.Steps {
		steps[i] = step.ToDto(c)
	}

	return &RecipeDTO{
		Id:               r.Id,
		Name:             r.Name,
		Description:      r.Meta.Description,
		Summary:          r.Meta.Summary,
		Logo:             r.Meta.Logo,
		IsInstallStarted: r.IsInstallStarted,
		Steps:            steps,
	}
}
