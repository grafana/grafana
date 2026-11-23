package v0alpha1

import (
	"time"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Mirrors metav1.Condition with the same JSON encoding: lastTransitionTime is an RFC3339 timestamp, or null when unset.
type ConnectionCondition struct {
	// type of condition in CamelCase or in foo.example.com/CamelCase.
	Type string `json:"type"`
	// status of the condition, one of True, False, Unknown.
	Status string `json:"status"`
	// observedGeneration represents the .metadata.generation that the condition was set based upon.
	ObservedGeneration *int64 `json:"observedGeneration,omitempty"`
	// lastTransitionTime is the last time the condition transitioned from one status to another.
	LastTransitionTime *string `json:"lastTransitionTime"`
	// reason contains a programmatic identifier indicating the reason for the condition's last transition.
	Reason string `json:"reason"`
	// message is a human readable message indicating details about the transition.
	Message string `json:"message"`
}

func (ConnectionCondition) OpenAPIModelName() string {
	return OpenAPIPrefix + "ConnectionCondition"
}

// conditionFields is the shape App SDK codegen produces for the #Condition CUE definition.
// Each kind gets its own named condition type with this underlying struct, so the adapters
// below are generic over it rather than written once per kind.
type conditionFields = struct {
	Type               string  `json:"type"`
	Status             string  `json:"status"`
	ObservedGeneration *int64  `json:"observedGeneration,omitempty"`
	LastTransitionTime *string `json:"lastTransitionTime"`
	Reason             string  `json:"reason"`
	Message            string  `json:"message"`
}

// Condition is satisfied by the condition type of every kind.
type Condition interface {
	~conditionFields
}

// ConditionToMeta converts a condition so the k8s.io/apimachinery/pkg/api/meta helpers can be used.
// An unparsable lastTransitionTime becomes the zero time.
func ConditionToMeta[C Condition](c C) metav1.Condition {
	f := conditionFields(c)
	out := metav1.Condition{
		Type:    f.Type,
		Status:  metav1.ConditionStatus(f.Status),
		Reason:  f.Reason,
		Message: f.Message,
	}
	if f.ObservedGeneration != nil {
		out.ObservedGeneration = *f.ObservedGeneration
	}
	if f.LastTransitionTime != nil {
		if t, err := time.Parse(time.RFC3339, *f.LastTransitionTime); err == nil {
			out.LastTransitionTime = metav1.NewTime(t.Local())
		}
	}
	return out
}

// ConditionFromMeta converts a metav1.Condition, leaving zero values nil so the JSON encoding
// matches that of the metav1.Condition.
func ConditionFromMeta[C Condition](c metav1.Condition) C {
	out := conditionFields{
		Type:    c.Type,
		Status:  string(c.Status),
		Reason:  c.Reason,
		Message: c.Message,
	}
	if c.ObservedGeneration != 0 {
		out.ObservedGeneration = &c.ObservedGeneration
	}
	if !c.LastTransitionTime.IsZero() {
		ts := c.LastTransitionTime.UTC().Format(time.RFC3339)
		out.LastTransitionTime = &ts
	}
	return C(out)
}

func ConditionsToMeta[C Condition](in []C) []metav1.Condition {
	if in == nil {
		return nil
	}
	out := make([]metav1.Condition, len(in))
	for i, c := range in {
		out[i] = ConditionToMeta(c)
	}
	return out
}

func ConditionsFromMeta[C Condition](in []metav1.Condition) []C {
	if in == nil {
		return nil
	}
	out := make([]C, len(in))
	for i, c := range in {
		out[i] = ConditionFromMeta[C](c)
	}
	return out
}

// SetStatusCondition applies meta.SetStatusCondition to conditions and reports whether they changed.
func SetStatusCondition[C Condition](conditions *[]C, newCondition metav1.Condition) bool {
	metaConditions := ConditionsToMeta(*conditions)
	changed := meta.SetStatusCondition(&metaConditions, newCondition)
	if changed {
		*conditions = ConditionsFromMeta[C](metaConditions)
	}
	return changed
}
