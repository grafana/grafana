package models

import "context"

// ObjectSummary represents common data derived from a raw object bytes.
// The values should not depend on system state, and are derived from the raw object.
// This summary is used for a unified search and object listing
type ObjectSummary struct {
	UID         string `json:"uid,omitempty"`
	Kind        string `json:"kind,omitempty"`
	Name        string `json:"name,omitempty"`
	Description string `json:"description,omitempty"`

	// Key value pairs.  Tags are are represented as keys with empty values
	Labels map[string]string `json:"labels,omitempty"`

	// URL should only be set if the value is not derived directly from kind+uid
	// NOTE: this may go away with a more robust GRN solution /!\
	URL string `json:"URL,omitempty"`

	// When errors exist
	Error *ObjectErrorInfo `json:"error,omitempty"`

	// Optional field values.  The schema will define and document possible values for a given kind
	Fields map[string]interface{} `json:"fields,omitempty"`

	// eg: panels within dashboard
	Nested []*ObjectSummary `json:"nested,omitempty"`

	// Optional references to external things
	References []*ObjectExternalReference `json:"references,omitempty"`

	// The summary can not be extended
	_ interface{}
}

// This will likely get replaced with a more general error framework.
type ObjectErrorInfo struct {
	// TODO: Match an error code registry?
	Code int64 `json:"code,omitempty"`

	// Simple error display
	Message string `json:"message,omitempty"`

	// Error details
	Details interface{} `json:"details,omitempty"`
}

// Reference to another object outside itself
// This message is derived from the object body and can be used to search for references.
// This does not represent a method to declare a reference to another object.
type ObjectExternalReference struct {
	// datasource (instance), dashboard (instance),
	Kind string `json:"kind,omitempty"`

	// prometheus / heatmap, heatamp|prometheus
	Type string `json:"type,omitempty"` // flavor

	// Unique ID for this object
	UID string `json:"UID,omitempty"`
}

// ObjectSummaryBuilder will read an object, validate it, and return a summary, sanitized payload, or an error
// This should not include values that depend on system state, only the raw object
type ObjectSummaryBuilder = func(ctx context.Context, uid string, body []byte) (*ObjectSummary, []byte, error)
