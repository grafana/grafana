package recipes

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

func newInstructionStep(installer plugins.Installer, cfg *setting.Cfg, meta RecipeStepMeta, instructionText string) *instructionStep {
	return &instructionStep{
		Action:          "install-plugin",
		Meta:            meta,
		InstructionText: instructionText,
		installer:       installer,
		cfg:             cfg,
	}
}

type instructionStep struct {
	Action          string           `json:"action"`
	Meta            RecipeStepMeta   `json:"meta"`
	InstructionText string           `json:"instructionText"`
	Status          RecipeStepStatus `json:"status"`
	installer       plugins.Installer
	cfg             *setting.Cfg
}

func (s *instructionStep) Apply(c context.Context) error {
	// TODO: figure out what to do when applying an instruction?

	s.Status = RecipeStepStatus{
		Status:        "Shown",
		StatusMessage: "Instructions shown successfully.",
	}

	return nil
}

func (s *instructionStep) Revert(c context.Context) error {
	s.Status = RecipeStepStatus{
		Status:        "NotShown",
		StatusMessage: "The instruction message was not shown yet.",
	}

	return nil
}
