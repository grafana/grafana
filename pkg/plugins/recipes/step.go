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
