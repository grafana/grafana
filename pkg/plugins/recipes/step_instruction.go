package recipes

import (
	"context"

	"github.com/grafana/grafana/pkg/setting"
)

type InstructionStep struct {
	Meta                                RecipeStepMeta   `json:"meta"`
	Status                              RecipeStepStatus `json:"status"`
	InstructionText                     string           `json:"instructionText"`                     // The instruction as Markdown text
	InstructionTestURL                  string           `json:"instructionTestURL"`                  // The URL to test if the requested changes are configured. If left empty then no test button will be added.
	InstructionTestExpectedHttpResponse string           `json:"instructionTestExpectedHttpResponse"` // E.g. "200"
	cfg                                 *setting.Cfg
}

func (s *InstructionStep) Apply(c context.Context) error {
	s.Status = RecipeStepStatus{
		Status:        "Visible",
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
