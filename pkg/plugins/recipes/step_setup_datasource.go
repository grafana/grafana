package recipes

import (
	"context"
)

func newSetupDatasourceStep(meta RecipeStepMeta) *setupDatasourceStep {
	return &setupDatasourceStep{
		Action: "setup-dashboard",
		Meta:   meta,
	}
}

type setupDatasourceStep struct {
	Action string           `json:"action"`
	Meta   RecipeStepMeta   `json:"meta"`
	Status RecipeStepStatus `json:"status"`
}

func (s *setupDatasourceStep) Apply(c context.Context) error {
	// TODO: figure out what to do when applying an instruction?

	s.Status = RecipeStepStatus{
		Status:        "Shown",
		StatusMessage: "Instructions shown successfully.",
	}

	return nil
}

func (s *setupDatasourceStep) Revert(c context.Context) error {
	s.Status = RecipeStepStatus{
		Status:        "NotShown",
		StatusMessage: "The instruction message was not shown yet.",
	}

	return nil
}
