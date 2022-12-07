package recipes

import "github.com/grafana/grafana/pkg/models"

func newPromptStep(meta PromptStepMeta) *PromptStep {
	return &PromptStep{
		Action: "prompt",
		Meta:   meta,
	}
}

// A step used to prompt information from the user
type PromptStep struct {
	Action string         `json:"action"`
	Meta   PromptStepMeta `json:"meta"`
}

type PromptStepMeta struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Prompts     []Prompt `json:"prompts"` // The list of prompts
}
type PromptOption struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type Prompt struct {
	Label        string         `json:"label"`
	Description  string         `json:"description"`
	Type         string         `json:"type"`        // The type of the prompt input ("text", "number", "radio", "select", "multiselect")
	Placeholder  string         `json:"placeholder"` //
	DefaultValue string         `json:"defaultValue"`
	Options      []PromptOption `json:"options"` // Only for "radio", "select" or "multiselect" fields
}

func (s *PromptStep) Apply(c *models.ReqContext) error {
	return nil
}

func (s *PromptStep) Revert(c *models.ReqContext) error {
	return nil
}

func (s *PromptStep) Status(c *models.ReqContext) (StepStatus, error) {
	return Completed, nil
}
