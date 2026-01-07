package auditing

import (
	"encoding/json"
	"time"
)

type Event struct {
	// The namespace the action was performed in.
	Namespace string `json:"namespace"`

	// When it happened.
	ObservedAt time.Time `json:"-"` // see MarshalJSON for why this is omitted

	// Who/what performed the action.
	SubjectName string `json:"subjectName"`
	SubjectUID  string `json:"subjectUID"`

	// What was performed.
	Verb string `json:"verb"`

	// The object the action was performed on. For verbs like "list" this will be empty.
	Object string `json:"object,omitempty"`

	// API information.
	APIGroup   string `json:"apiGroup,omitempty"`
	APIVersion string `json:"apiVersion,omitempty"`
	Kind       string `json:"kind,omitempty"`

	// Outcome of the action.
	Outcome EventOutcome `json:"outcome"`

	// Extra fields to add more context to the event.
	Extra map[string]string `json:"extra,omitempty"`
}

func (e Event) Time() time.Time {
	return e.ObservedAt
}

func (e Event) MarshalJSON() ([]byte, error) {
	type Alias Event
	return json.Marshal(&struct {
		FormattedTimestamp string `json:"observedAt"`
		Alias
	}{
		FormattedTimestamp: e.ObservedAt.UTC().Format(time.RFC3339Nano),
		Alias:              (Alias)(e),
	})
}

func (e Event) KVPairs() []any {
	args := []any{
		"audit", true,
		"namespace", e.Namespace,
		"observedAt", e.ObservedAt.UTC().Format(time.RFC3339Nano),
		"subjectName", e.SubjectName,
		"subjectUID", e.SubjectUID,
		"verb", e.Verb,
		"object", e.Object,
		"apiGroup", e.APIGroup,
		"apiVersion", e.APIVersion,
		"kind", e.Kind,
		"outcome", e.Outcome,
	}

	if len(e.Extra) > 0 {
		extraArgs := make([]any, 0, len(e.Extra)*2)

		for k, v := range e.Extra {
			extraArgs = append(extraArgs, "extra_"+k, v)
		}

		args = append(args, extraArgs...)
	}

	return args
}

type EventOutcome string

const (
	EventOutcomeUnknown             EventOutcome = "unknown"
	EventOutcomeSuccess             EventOutcome = "success"
	EventOutcomeFailureUnauthorized EventOutcome = "failure_unauthorized"
	EventOutcomeFailureNotFound     EventOutcome = "failure_not_found"
	EventOutcomeFailureGeneric      EventOutcome = "failure_generic"
)
