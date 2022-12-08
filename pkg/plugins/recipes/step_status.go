package recipes

import (
	"encoding/json"
	"fmt"
	"strings"
)

type StepStatus int8

const (
	Completed StepStatus = iota
	NotCompleted
	Error
)

func (s StepStatus) String() string {
	switch s {
	case Completed:
		return "completed"
	case NotCompleted:
		return "notCompleted"
	case Error:
		return "error"
	}
	return "unknown"
}

func (s StepStatus) MarshalJSON() ([]byte, error) {
	raw := s.String()

	if raw == "unkown" {
		return nil, fmt.Errorf("unkown step status: %s", s)
	}

	return json.Marshal(raw)
}

func (s *StepStatus) UnmarshalJSON(text []byte) error {
	var raw string
	if err := json.Unmarshal(text, &raw); err != nil {
		return err
	}

	switch strings.ToLower(raw) {
	case "completed":
		*s = Completed
		break
	case "notCompleted":
		*s = NotCompleted
		break
	case "error":
		*s = Error
		break
	default:
		return fmt.Errorf("invalid step status: %s", s)
	}

	return nil
}

func (s *StepStatus) ToDto(err error) *RecipeStepStatusDTO {
	if err != nil {
		return &RecipeStepStatusDTO{
			Code:    s.String(),
			Message: err.Error(),
		}
	}

	return &RecipeStepStatusDTO{
		Code: s.String(),
	}
}
