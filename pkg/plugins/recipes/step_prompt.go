package recipes

import "github.com/grafana/grafana/pkg/models"

func newPromptStep(meta PromptStepMeta) *PromptStep {
	meta.Status = NotCompleted

	return &PromptStep{
		Action: "prompt",
		Meta:   meta,
		Settings: &promptSettings{
			Prompts: make([]Prompt, 0),
		},
	}
}

// A step used to prompt information from the user
type PromptStep struct {
	Action   string          `json:"action"`
	Meta     PromptStepMeta  `json:"meta"`
	Settings *promptSettings `json:"settings"`
}

type promptSettings struct {
	Prompts []Prompt `json:"prompts"`
}

type PromptStepMeta struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Status      StepStatus
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
	s.Meta.Status = Completed

	return nil
}

func (s *PromptStep) Revert(c *models.ReqContext) error {
	s.Meta.Status = NotCompleted

	return nil
}

func (s *PromptStep) Status(c *models.ReqContext) (StepStatus, error) {
	return s.Meta.Status, nil
}

func (s *PromptStep) ToDto(c *models.ReqContext) *RecipeStepDTO {
	status, err := s.Status(c)

	return &RecipeStepDTO{
		Action:      s.Action,
		Name:        s.Meta.Name,
		Description: s.Meta.Description,
		Status:      *status.ToDto(err),
		Settings:    s.Settings,
	}
}
