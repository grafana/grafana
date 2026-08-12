package entity

import context "context"

//-----------------------------------------------------------------------------------------------------
// NOTE: the object store is in heavy development, and the locations will likely continue to move
//-----------------------------------------------------------------------------------------------------

const (
	StandardKindDashboard = "dashboard"
	StandardKindFolder    = "folder"

	// StandardKindDataSource: not a real kind yet, but used to define references from dashboards
	// Types: influx, prometheus, testdata, ...
	StandardKindDataSource = "ds"

	// StandardKindPanel: only used for searchV2 right now
	// Standalone panel is not an object kind yet -- library panel, or nested in dashboard
	StandardKindPanel = "panel"

	// StandardKindQuery early development on panel query library
	// the kind may need to change to better encapsulate { targets:[], transforms:[] }
	StandardKindQuery = "query"

	// StandardKindAlertRule is not a real kind. It's used to refer to alert rules, for instance
	// in the folder registry service.
	StandardKindAlertRule = "alertrule"

	// StandardKindLibraryPanel is for library panels
	StandardKindLibraryPanel = "librarypanel"

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

// EntitySummaryBuilder will read an object, validate it, and return a summary, sanitized payload, or an error
// This should not include values that depend on system state, only the raw object
type EntitySummaryBuilder = func(ctx context.Context, uid string, body []byte) (*EntitySummary, []byte, error)

type EntitySummary struct {
	UID         string `protobuf:"bytes,1,opt,name=UID,proto3" json:"UID,omitempty"`
	Kind        string `protobuf:"bytes,2,opt,name=kind,proto3" json:"kind,omitempty"`
	Name        string `protobuf:"bytes,3,opt,name=name,proto3" json:"name,omitempty"`
	Description string `protobuf:"bytes,4,opt,name=description,proto3" json:"description,omitempty"`
	// Key value pairs.  Tags are are represented as keys with empty values
	Labels map[string]string `protobuf:"bytes,5,rep,name=labels,proto3" json:"labels,omitempty" protobuf_key:"bytes,1,opt,name=key,proto3" protobuf_val:"bytes,2,opt,name=value,proto3"`
	// Parent folder UID
	Folder string `protobuf:"bytes,6,opt,name=folder,proto3" json:"folder,omitempty"`
	// URL safe version of the name.  It will be unique within the folder
	Slug string `protobuf:"bytes,7,opt,name=slug,proto3" json:"slug,omitempty"`
	// When errors exist
	Error *EntityErrorInfo `protobuf:"bytes,8,opt,name=error,proto3" json:"error,omitempty"`
	// Optional field values.  The schema will define and document possible values for a given kind
	Fields map[string]string `protobuf:"bytes,9,rep,name=fields,proto3" json:"fields,omitempty" protobuf_key:"bytes,1,opt,name=key,proto3" protobuf_val:"bytes,2,opt,name=value,proto3"`
	// eg: panels within dashboard
	Nested []*EntitySummary `protobuf:"bytes,10,rep,name=nested,proto3" json:"nested,omitempty"`
	// Optional references to external things
	References []*EntityExternalReference `protobuf:"bytes,11,rep,name=references,proto3" json:"references,omitempty"`
}

// Report error while working with entitys
// NOTE: real systems at scale will contain errors.
type EntityErrorInfo struct {
	// Match an error code registry?
	Code int64 `protobuf:"varint,1,opt,name=code,proto3" json:"code,omitempty"`
	// Simple error display
	Message string `protobuf:"bytes,2,opt,name=message,proto3" json:"message,omitempty"`
	// Details encoded in JSON
	DetailsJson []byte `protobuf:"bytes,3,opt,name=details_json,json=detailsJson,proto3" json:"details_json,omitempty"`
}

type EntityExternalReference struct {
	// Category of dependency
	// eg: datasource, plugin, runtime
	Family string `protobuf:"bytes,1,opt,name=family,proto3" json:"family,omitempty"`
	// datasource > prometheus|influx|...
	// plugin > panel | datasource
	// runtime > transformer
	Type string `protobuf:"bytes,2,opt,name=type,proto3" json:"type,omitempty"`
	// datasource > UID
	// plugin > plugin identifier
	// runtime > name lookup
	Identifier string `protobuf:"bytes,3,opt,name=identifier,proto3" json:"identifier,omitempty"`
}
