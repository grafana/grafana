package models

import (
	"encoding/json"
	"fmt"
	"math"
	"time"
)

// LastResult contains the values and condition from the most recent evaluation.
type LastResult struct {
	Values    map[string]float64 `json:"values,omitempty"`
	Condition string             `json:"condition,omitempty"`
}

// FromDB loads LastResult from JSON.
func (r *LastResult) FromDB(b []byte) error {
	if len(b) == 0 {
		return nil
	}
	var raw struct {
		Values    map[string]any `json:"values,omitempty"`
		Condition string         `json:"condition,omitempty"`
	}
	if err := json.Unmarshal(b, &raw); err != nil {
		return err
	}

	var err error
	r.Values, err = unjsonifyValues(raw.Values)
	if err != nil {
		return err
	}

	r.Condition = raw.Condition

	return nil
}

// ToDB serializes LastResult to JSON.
func (r LastResult) ToDB() ([]byte, error) {
	if len(r.Values) == 0 && r.Condition == "" {
		return nil, nil
	}
	safe := struct {
		Values    map[string]any `json:"values,omitempty"`
		Condition string         `json:"condition,omitempty"`
	}{
		Values:    jsonifyValues(r.Values),
		Condition: r.Condition,
	}
	return json.Marshal(safe)
}

// AlertInstance represents a single alert instance.
type AlertInstance struct {
	AlertInstanceKey   `xorm:"extends"`
	Labels             InstanceLabels
	Annotations        InstanceAnnotations
	CurrentState       InstanceStateType
	CurrentReason      string
	CurrentStateSince  time.Time
	CurrentStateEnd    time.Time
	LastEvalTime       time.Time
	LastSentAt         *time.Time
	FiredAt            *time.Time
	ResolvedAt         *time.Time
	ResultFingerprint  string
	EvaluationDuration time.Duration `xorm:"evaluation_duration_ns"`
	LastError          string        `xorm:"last_error"`
	LastResult         LastResult    `xorm:"last_result"`
}

type AlertInstanceKey struct {
	RuleOrgID  int64  `xorm:"rule_org_id"`
	RuleUID    string `xorm:"rule_uid"`
	LabelsHash string
}

// InstanceStateType is an enum for instance states.
type InstanceStateType string

const (
	// InstanceStateFiring is for a firing alert.
	InstanceStateFiring InstanceStateType = "Alerting"
	// InstanceStateNormal is for a normal alert.
	InstanceStateNormal InstanceStateType = "Normal"
	// InstanceStatePending is for an alert that is firing but has not met the duration
	InstanceStatePending InstanceStateType = "Pending"
	// InstanceStateNoData is for an alert with no data.
	InstanceStateNoData InstanceStateType = "NoData"
	// InstanceStateError is for an erroring alert.
	InstanceStateError InstanceStateType = "Error"
	// InstanceStateRecovering is for a recovering alert.
	InstanceStateRecovering InstanceStateType = "Recovering"
)

// IsValid checks that the value of InstanceStateType is a valid
// string.
func (i InstanceStateType) IsValid() bool {
	return i == InstanceStateFiring ||
		i == InstanceStateNormal ||
		i == InstanceStateNoData ||
		i == InstanceStatePending ||
		i == InstanceStateError ||
		i == InstanceStateRecovering
}

// ListAlertInstancesQuery is the query list alert Instances.
type ListAlertInstancesQuery struct {
	RuleUID   string
	RuleOrgID int64 `json:"-"`
	RuleGroup string
}

// ValidateAlertInstance validates that the alert instance contains an alert rule id,
// and state.
func ValidateAlertInstance(alertInstance AlertInstance) error {
	if alertInstance.RuleOrgID == 0 {
		return fmt.Errorf("alert instance is invalid due to missing alert rule organisation")
	}

	if alertInstance.RuleUID == "" {
		return fmt.Errorf("alert instance is invalid due to missing alert rule uid")
	}

	if !alertInstance.CurrentState.IsValid() {
		return fmt.Errorf("alert instance is invalid because the state '%v' is invalid", alertInstance.CurrentState)
	}

	return nil
}

// jsonifyValues converts a map of float64 values to a JSON-safe map.
// NaN and Inf values are converted to their string representations
// since JSON doesn't support these special float values
func jsonifyValues(values map[string]float64) map[string]any {
	if values == nil {
		return nil
	}
	result := make(map[string]any, len(values))
	for k, v := range values {
		if math.IsNaN(v) || math.IsInf(v, 0) {
			result[k] = fmt.Sprintf("%f", v) // "NaN", "+Inf", "-Inf"
		} else {
			result[k] = v
		}
	}
	return result
}

// unjsonifyValues converts a JSON-decoded map back to float64 values.
// String values "NaN", "+Inf", "-Inf" are converted back to their
// corresponding float64 special values.
func unjsonifyValues(values map[string]any) (map[string]float64, error) {
	if values == nil {
		return nil, nil
	}
	result := make(map[string]float64, len(values))
	for k, v := range values {
		switch val := v.(type) {
		case float64:
			result[k] = val
		case string:
			switch val {
			case "NaN":
				result[k] = math.NaN()
			case "+Inf":
				result[k] = math.Inf(1)
			case "-Inf":
				result[k] = math.Inf(-1)
			default:
				return nil, fmt.Errorf("invalid string value for key %q: %q", k, val)
			}
		default:
			return nil, fmt.Errorf("invalid value type for key %q: %T", k, v)
		}
	}
	return result, nil
}
