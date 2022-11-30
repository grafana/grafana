package models

//-----------------------------------------------------------------------------------------------------
// NOTE: the object store is in heavy development, and the locations will likely continue to move
//-----------------------------------------------------------------------------------------------------

import "context"

const (
	StandardKindDashboard = "dashboard"
	StandardKindPlaylist  = "playlist"
	StandardKindSnapshot  = "snapshot"
	StandardKindFolder    = "folder"

	// StandardKindDataSource: not a real kind yet, but used to define references from dashboards
	// Types: influx, prometheus, testdata, ...
	StandardKindDataSource = "ds"

	// StandardKindPanel: only used for searchV2 right now
	// Standalone panel is not an object kind yet -- library panel, or nested in dashboard
	StandardKindPanel = "panel"

	// StandardKindSVG SVG file support
	StandardKindSVG = "svg"

	// StandardKindPNG PNG file support
	StandardKindPNG = "png"

	// StandardKindGeoJSON represents spatial data
	StandardKindGeoJSON = "geojson"

	// StandardKindDataFrame data frame
	StandardKindDataFrame = "frame"

	// StandardKindJSONObj generic json object
	StandardKindJSONObj = "jsonobj"

	// StandardKindQuery early development on panel query library
	// the kind may need to change to better encapsulate { targets:[], transforms:[] }
	StandardKindQuery = "query"

	//----------------------------------------
	// References are referenced from objects
	//----------------------------------------

	// ExternalEntityReferencePlugin: requires a plugin to be installed
	ExternalEntityReferencePlugin = "plugin"

	// ExternalEntityReferenceRuntime: frontend runtime requirements
	ExternalEntityReferenceRuntime = "runtime"

	// ExternalEntityReferenceRuntime_Transformer is a "type" under runtime
	// UIDs include: joinByField, organize, seriesToColumns, etc
	ExternalEntityReferenceRuntime_Transformer = "transformer"
)

// EntityKindInfo describes information needed from the object store
// All non-raw types will have a schema that can be used to validate
type EntityKindInfo struct {
	// Unique short id for this kind
	ID string `json:"id,omitempty"`

	// Display name (may be equal to the ID)
	Name string `json:"name,omitempty"`

	// Kind description
	Description string `json:"description,omitempty"`

	// The format is not controlled by a schema
	IsRaw bool `json:"isRaw,omitempty"`

	// The preferred save extension (svg, png, parquet, etc) if one exists
	FileExtension string `json:"fileExtension,omitempty"`

	// The correct mime-type to return for raw objects
	MimeType string `json:"mimeType,omitempty"`
}

// EntitySummary represents common data derived from a raw object bytes.
// The values should not depend on system state, and are derived from the raw object.
// This summary is used for a unified search and object listing
type EntitySummary struct {
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
	Error *EntityErrorInfo `json:"error,omitempty"`

	// Optional field values.  The schema will define and document possible values for a given kind
	Fields map[string]interface{} `json:"fields,omitempty"`

	// eg: panels within dashboard
	Nested []*EntitySummary `json:"nested,omitempty"`

	// Optional references to external things
	References []*EntityExternalReference `json:"references,omitempty"`

	// The summary can not be extended
	_ interface{}
}

// This will likely get replaced with a more general error framework.
type EntityErrorInfo struct {
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
type EntityExternalReference struct {
	// datasource (instance), dashboard (instance),
	Kind string `json:"kind,omitempty"`

	// prometheus / heatmap, heatamp|prometheus
	Type string `json:"type,omitempty"` // flavor

	// Unique ID for this object
	UID string `json:"UID,omitempty"`
}

// EntitySummaryBuilder will read an object, validate it, and return a summary, sanitized payload, or an error
// This should not include values that depend on system state, only the raw object
type EntitySummaryBuilder = func(ctx context.Context, uid string, body []byte) (*EntitySummary, []byte, error)
