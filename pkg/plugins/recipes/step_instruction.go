package recipes

import (
	"context"
)

func newInstructionStep(meta InstructionStepMeta) *InstructionStep {
	return &InstructionStep{
		Action: "display-info",
		Meta:   meta,
	}
}

type InstructionStep struct {
	Action string              `json:"action"`
	Meta   InstructionStepMeta `json:"meta"`
	Status RecipeStepStatus    `json:"status"`
}

type InstructionStepMeta struct {
	Name                                string `json:"name"`
	Description                         string `json:"description"`
	InstructionText                     string `json:"instructionText"`                     // The instruction as Markdown text
	InstructionTestURL                  string `json:"instructionTestURL"`                  // The URL to test if the requested changes are configured. If left empty then no test button will be added.
	InstructionTestExpectedHttpResponse string `json:"instructionTestExpectedHttpResponse"` // E.g. "200"
}

func (s *InstructionStep) Apply(c context.Context) error {
	s.Status = RecipeStepStatus{
		Status:        "Completed",
		StatusMessage: "Please follow the instructions.",
	}

	return nil
}

func (s *InstructionStep) Revert(c context.Context) error {
	s.Status = RecipeStepStatus{
		Status:        "NotCompleted",
		StatusMessage: "",
	}

	return nil
}
