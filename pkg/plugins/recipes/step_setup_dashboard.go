package recipes

import (
	"context"
)

func newSetupDashboardStep(meta dashboardStepMeta) *dashboardStep {
	return &dashboardStep{
		Action: "setup-dashboard",
		Meta:   meta,
	}
}

type dashboardStepMeta struct {
	RecipeStepMeta
	Screenshots []RecipeStepScreenshot `json:"screenshots"`
}

type dashboardStep struct {
	Action string            `json:"action"`
	Meta   dashboardStepMeta `json:"meta"`
	Status RecipeStepStatus  `json:"status"`
}

func (s *dashboardStep) Apply(c context.Context) error {
	// TODO: figure out what to do when applying an instruction?

	s.Status = RecipeStepStatus{
		Status:        "Shown",
		StatusMessage: "Instructions shown successfully.",
	}

	return nil
}

func (s *dashboardStep) Revert(c context.Context) error {
	s.Status = RecipeStepStatus{
		Status:        "NotShown",
		StatusMessage: "The instruction message was not shown yet.",
	}

	return nil
}
