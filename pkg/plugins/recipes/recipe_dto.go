package recipes

type RecipeDTO struct {
	Id          string           `json:"id"`
	Name        string           `json:"name"`
	Summary     string           `json:"summary"`
	Description string           `json:"description"`
	Logo        string           `json:"logo"`
	Steps       []*RecipeStepDTO `json:"steps"`
}

type RecipeStepDTO struct {
	Action      string              `json:"action"`
	Status      RecipeStepStatusDTO `json:"status"`
	Name        string              `json:"name"`
	Description string              `json:"description"`
	Settings    interface{}         `json:"settings"`
}

type RecipeStepStatusDTO struct {
	Code    string `json:"code"`
	Message string `json:"message,omitempty"`
}
