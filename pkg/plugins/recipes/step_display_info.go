package recipes

import "github.com/grafana/grafana/pkg/models"

func newInstructionStep(meta InstructionStepMeta) *InstructionStep {
	meta.Status = NotCompleted

	return &InstructionStep{
		Action: "display-info",
		Meta:   meta,
	}
}

type InstructionStep struct {
	Action string              `json:"action"`
	Meta   InstructionStepMeta `json:"meta"`
}

type instructionStepSettings struct {
	Instruction              []Instruction `json:"instruction"`                         // The instruction as Markdown text
	TestURL                  string        `json:"instructionTestURL"`                  // The URL to test if the requested changes are configured. If left empty then no test button will be added.
	TestExpectedHttpResponse string        `json:"instructionTestExpectedHttpResponse"` // E.g. "200"
}

type Instruction struct {
	Os       string `json:"os"` // "macos", "ubuntu", "windows"
	Markdown string `json:"markdown"`
}

type InstructionStepMeta struct {
	Name                                string        `json:"name"`
	Description                         string        `json:"description"`
	Instruction                         []Instruction `json:"instruction"`
	InstructionTestURL                  string        `json:"instructionTestURL"`                  // The URL to test if the requested changes are configured. If left empty then no test button will be added.
	InstructionTestExpectedHttpResponse string        `json:"instructionTestExpectedHttpResponse"` // E.g. "200"
	Status                              StepStatus
}

func (s *InstructionStep) Apply(c *models.ReqContext) error {
	s.Meta.Status = Completed

	return nil
}

func (s *InstructionStep) Revert(c *models.ReqContext) error {
	s.Meta.Status = NotCompleted

	return nil
}

func (s *InstructionStep) Status(c *models.ReqContext) (StepStatus, error) {
	return s.Meta.Status, nil
}

func (s *InstructionStep) ToDto(c *models.ReqContext) *RecipeStepDTO {
	status, err := s.Status(c)

	return &RecipeStepDTO{
		Action:      s.Action,
		Name:        s.Meta.Name,
		Description: s.Meta.Description,
		Status:      *status.ToDto(err),
		Settings: &instructionStepSettings{
			Instruction:              s.Meta.Instruction,
			TestURL:                  s.Meta.InstructionTestURL,
			TestExpectedHttpResponse: s.Meta.InstructionTestExpectedHttpResponse,
		},
	}
}
