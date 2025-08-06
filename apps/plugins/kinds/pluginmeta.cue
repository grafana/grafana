package plugins

import (
	"time"
)

pluginMetaV0Alpha1: {
	kind: "PluginMeta"
	plural: "pluginsmeta"
	scope: "Namespaced"
	schema: {
		spec: {
			pluginJSON: #JSONData,
		}
	}
}

// JSON configuration schema for Grafana plugins
// Converted from: https://github.com/grafana/grafana/blob/main/docs/sources/developers/plugins/plugin.schema.json
#JSONData: {
	// Unique name of the plugin
	id: string

	// Plugin type
	type: "app" | "datasource" | "panel" | "renderer"

	// Human-readable name of the plugin
	name: string

	// Metadata for the plugin
	info: #Info

	// Dependency information
	dependencies: #Dependencies

	// Optional fields
	alerting?: bool
	annotations?: bool
	autoEnabled?: bool
	backend?: bool
	buildMode?: string
	builtIn?: bool
	category?: "tsdb" | "logging" | "cloud" | "tracing" | "profiling" | "sql" | "enterprise" | "iot" | "other"
	enterpriseFeatures?: #EnterpriseFeatures
	executable?: string
	hideFromList?: bool
	// +listType=atomic
	includes?: [...#Include]
	logs?: bool
	metrics?: bool
	multiValueFilterOperators?: bool
	pascalName?: string
	preload?: bool
	queryOptions?: #QueryOptions
	// +listType=atomic
	routes?: [...#Route]
	skipDataQuery?: bool
	state?: "alpha" | "beta"
	streaming?: bool
	tracing?: bool
	iam?: #IAM
	// +listType=atomic
	roles?: [...#Role]
	extensions?: #Extensions
}

#Info: {
	// Required fields
	// +listType=set
	keywords: [...string]
	logos: {
		small: string
		large: string
	}
	updated: string & time.Time
	version: string
	// Optional fields
	author?: {
		name?: string
		email?: string
		url?: string
	}
	description?: string
	// +listType=atomic
	links?: [...{
		name?: string
		url?: string
	}]
	// +listType=atomic
	screenshots?: [...{
		name?: string
		path?: string
	}]
}

#Dependencies: {
	// Required field
	grafanaDependency: string

	// Optional fields
	grafanaVersion?: string
	// +listType=set
	// +listMapKey=id
	plugins?: [...{
		id: string
		type: "app" | "datasource" | "panel"
		name: string
	}]
	extensions?: {
		// +listType=set
		exposedComponents?: [...string]
	}
}

#EnterpriseFeatures: {
	healthDiagnosticsErrors?: bool | *false
	// Allow additional properties
	[string]: _
}

#Include: {
	uid?: string
	type?: "dashboard" | "page" | "panel" | "datasource"
	name?: string
	component?: string
	role?: "Admin" | "Editor" | "Viewer"
	action?: string
	path?: string
	addToNav?: bool
	defaultNav?: bool
	icon?: string
}

#QueryOptions: {
	maxDataPoints?: bool
	minInterval?: bool
	cacheTimeout?: bool
}

#Route: {
	path?: string
	method?: string
	url?: string
	reqSignedIn?: bool
	reqRole?: string
	reqAction?: string
	// +listType=atomic
	headers?: [...string]
	body?: [string]: _
	tokenAuth?: {
		url?: string
		// +listType=set
		scopes?: [...string]
		params?: [string]: _
	}
	jwtTokenAuth?: {
		url?: string
		// +listType=set
		scopes?: [...string]
		params?: [string]: _
	}
	// +listType=atomic
	urlParams?: [...{
		name?: string
		content?: string
	}]
}

#IAM: {
	// +listType=atomic
	permissions?: [...{
		action?: string
		scope?: string
	}]
}

#Role: {
	role?: {
		name?: string
		description?: string
		// +listType=atomic
		permissions?: [...{
			action?: string
			scope?: string
		}]
	}
	// +listType=set
	grants?: [...string]
}

#Extensions: {
	// +listType=atomic
	addedComponents?: [...{
		// +listType=set
		targets: [...string]
		title: string
		description?: string
	}]
	// +listType=atomic
	addedLinks?: [...{
		// +listType=set
		targets: [...string]
		title: string
		description?: string
	}]
	// +listType=set
	// +listMapKey=id
	exposedComponents?: [...{
		id: string
		title?: string
		description?: string
	}]
	// +listType=set
	// +listMapKey=id
	extensionPoints?: [...{
		id: string
		title?: string
		description?: string
	}]
}
