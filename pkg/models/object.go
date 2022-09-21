package models

// RawObject maps pretty closely to raw blob storage
type RawObject struct {
	UID  string `json:"uid"`
	Kind string `json:"kind"`

	// Who saved it when
	Created   int64 `json:"created,omitempty"`   // timestamp
	CreatedBy int64 `json:"createdBy,omitempty"` // user_id
	Updated   int64 `json:"updated,omitempty"`   // timestamp  Last-Modified
	UpdatedBy int64 `json:"updatedBy,omitempty"` // user_id

	// Raw body
	Size int64  `json:"size"`           // Content-Length
	ETag string `json:"etag,omitempty"` // MD5 digest of the Body
	Body []byte `json:"-"`              // don't return this as JSON unless explicit

	// Optional additional properties managed by the underlying storage
	Properties map[string]string `json:"properties,omitempty"`

	// Not in every object store, but might be
	Version     string `json:"version,omitempty"`  // commit hash, incrementing number (as string)
	SyncTime    int64  `json:"syncTime,omitempty"` // when was the object synced from external source (provisioning or git)
	SaveMessage string `json:"message,omitempty"`  // the commit message when this was saved
}

// ObjectSummary is derived from a RawObject and should not depend on system state
type ObjectSummary struct {
	Name        string            `json:"name,omitempty"`
	Description string            `json:"description,omitempty"`
	Labels      map[string]string `json:"labels,omitempty"` // "tags" are represented as keys with empty values
	URL         string            `json:"URL,omitempty"`    // not great to save here, but maybe not terrible :shrug:
	Error       string            `json:"error,omitempty"`  // Reason the object is invalid

	// Optional values -- naming convention for types?
	Fields map[string]interface{} `json:"fields,omitempty"` // Saved as JSON, returned in results, but values not sortable

	// eg: panels within dashboard
	Nested []NestedObjectSummary `json:"nested,omitempty"`

	// Optional references to external things
	References []ExternalReference `json:"references,omitempty"`
}

// Nested sub types
type NestedObjectSummary struct {
	UID  string `json:"uid,omitempty"`
	Kind string `json:"kind,omitempty"`

	ObjectSummary
}

// links to other resources
type ExternalReference struct {
	Kind string `json:"kind,omitempty"` // datasource / panel
	Type string `json:"type,omitempty"` // prometheus / heatmap
	UID  string `json:"uid,omitempty"`  // path
}

// ObjectReader can inspect an object body and return an indexable summary
type ObjectReader = func(obj RawObject) (ObjectSummary, error)
