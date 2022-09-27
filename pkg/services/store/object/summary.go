package object

// ObjectSummary is derived from a RawObject and should not depend on system state
// The summary is used for a unified search and listings objects since the fully
type ObjectSummary struct {
	UID         string            `json:"uid,omitempty"`
	Kind        string            `json:"kind,omitempty"`
	Name        string            `json:"name,omitempty"`
	Description string            `json:"description,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"` // "tags" are represented as keys with empty values
	URL         string            `json:"URL,omitempty"`    // not great to save here, but maybe not terrible :shrug:
	Error       *ObjectErrorInfo  `json:"error,omitempty"`

	// Optional values -- schema will define the type
	Fields map[string]interface{} `json:"fields,omitempty"` // Saved as JSON, returned in results, but values not sortable

	// eg: panels within dashboard
	Nested []*ObjectSummary `json:"nested,omitempty"`

	// Optional references to external things
	References []*ExternalReference `json:"references,omitempty"`

	// struct can not be extended
	_ interface{}
}

// ObjectSummaryBuilder will read an object and create the summary.
// This should not include values that depend on system state, only the raw object
type ObjectSummaryBuilder = func(obj *RawObject) (ObjectSummary, error)
