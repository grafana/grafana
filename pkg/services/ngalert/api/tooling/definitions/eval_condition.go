package definitions

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// EvalAlertConditionCommand is the command for evaluating a condition
type EvalAlertConditionCommand struct {
	Condition string              `json:"condition"`
	Data      []models.AlertQuery `json:"data"` // TODO yuri. Create API model for AlertQuery
	Now       time.Time           `json:"now"`
}

func (cmd *EvalAlertConditionCommand) UnmarshalJSON(b []byte) error {
	type plain EvalAlertConditionCommand
	if err := json.Unmarshal(b, (*plain)(cmd)); err != nil {
		return err
	}

	return cmd.validate()
}

func (cmd *EvalAlertConditionCommand) validate() error {
	if cmd.Condition == "" {
		return fmt.Errorf("missing condition")
	}

	if len(cmd.Data) == 0 {
		return fmt.Errorf("missing data")
	}

	return nil
}
