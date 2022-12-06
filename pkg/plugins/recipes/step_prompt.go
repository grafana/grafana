package recipes

import (
	"context"
)

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

// A step used to prompt information from the user
type PromptStep struct {
	Meta    RecipeStepMeta   `json:"meta"`
	Status  RecipeStepStatus `json:"status"`
	Prompts []Prompt         `json:"prompts"` // The list of prompts
}

func (s *PromptStep) Apply(c context.Context) error {
	s.Status = RecipeStepStatus{
		Status:        "Visible",
		StatusMessage: "Please fill out the required information",
	}

	return nil
}

func (s *PromptStep) Revert(c context.Context) error {
	s.Status = RecipeStepStatus{
		Status:        "NotCompleted",
		StatusMessage: "",
	}

	return nil
}
