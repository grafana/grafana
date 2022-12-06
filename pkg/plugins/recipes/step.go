package recipes

import (
	"context"
)

type RecipeStep interface {
	Apply(c context.Context) error
	Revert(c context.Context) error
}

type RecipeStepMeta struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type RecipeStepStatus struct {
	Status        string `json:"status"`
	StatusMessage string `json:"statusMessage"`
}

type Recipe struct {
	Id          string       `json:"id"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Logo        string       `json:"logo"`
	Steps       []RecipeStep `json:"steps"`
}
