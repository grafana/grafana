package entity

import context "context"

//-----------------------------------------------------------------------------------------------------
// NOTE: the object store is in heavy development, and the locations will likely continue to move
//-----------------------------------------------------------------------------------------------------

const (
	StandardKindDashboard = "dashboard"
	StandardKindPlaylist  = "playlist"
	StandardKindFolder    = "folder"

	// StandardKindDataSource: not a real kind yet, but used to define references from dashboards
	// Types: influx, prometheus, testdata, ...
	StandardKindDataSource = "ds"

	// StandardKindPanel: only used for searchV2 right now
	// Standalone panel is not an object kind yet -- library panel, or nested in dashboard
	StandardKindPanel = "panel"

	// StandardKindJSONObj generic json object
	StandardKindJSONObj = "jsonobj"

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
