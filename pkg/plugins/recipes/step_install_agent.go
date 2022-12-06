package recipes

import (
	"context"
)

func newInstallAgentStep(meta RecipeStepMeta, metrics []AgentMetrics) *installAgentStep {
	return &installAgentStep{
		Action:  "install-agent",
		Meta:    meta,
		Metrics: metrics,
	}
}

type AgentMetrics struct {
	Name        string `json:"name"`
	Type        string `json:"type"`
	Description string `json:"description"`
}

type installAgentStep struct {
	Action  string           `json:"action"`
	Meta    RecipeStepMeta   `json:"meta"`
	Status  RecipeStepStatus `json:"status"`
	Metrics []AgentMetrics   `json:"metrics"`
}

func (s *installAgentStep) Apply(c context.Context) error {
	// TODO: figure out what to do when applying an instruction?

	s.Status = RecipeStepStatus{
		Status:        "Shown",
		StatusMessage: "Instructions shown successfully.",
	}

	return nil
}

func (s *installAgentStep) Revert(c context.Context) error {
	s.Status = RecipeStepStatus{
		Status:        "NotShown",
		StatusMessage: "The instruction message was not shown yet.",
	}

	return nil
}
