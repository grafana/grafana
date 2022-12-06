package recipes

import (
	"context"
)

func newSetupAlertsStep(meta RecipeStepMeta, alerts []AlertRule) *setupAlertsStep {
	return &setupAlertsStep{
		Action: "setup-alerts",
		Meta:   meta,
		Alerts: alerts,
	}
}

type AlertRule struct {
	Name      string `json:"name"`
	Group     string `json:"group"`
	Namespace string `json:"namespace"`
	Summary   string `json:"summary"`
}

type setupAlertsStep struct {
	Action string           `json:"action"`
	Meta   RecipeStepMeta   `json:"meta"`
	Status RecipeStepStatus `json:"status"`
	Alerts []AlertRule      `json:"alerts"`
}

func (s *setupAlertsStep) Apply(c context.Context) error {
	// TODO: figure out what to do when applying an instruction?

	s.Status = RecipeStepStatus{
		Status:        "Shown",
		StatusMessage: "Instructions shown successfully.",
	}

	return nil
}

func (s *setupAlertsStep) Revert(c context.Context) error {
	s.Status = RecipeStepStatus{
		Status:        "NotShown",
		StatusMessage: "The instruction message was not shown yet.",
	}

	return nil
}
