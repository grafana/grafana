// Code generated - EDITING IS FUTILE. DO NOT EDIT.

// JSON configuration schema for Grafana plugins
// Converted from: https://github.com/grafana/grafana/blob/main/docs/sources/developers/plugins/plugin.schema.json
export interface JSONData {
	// Unique name of the plugin
	id: string;
	// Plugin type
	type: "app" | "datasource" | "panel" | "renderer";
	// Human-readable name of the plugin
	name: string;
	// Metadata for the plugin
	info: Info;
	// Dependency information
	dependencies: Dependencies;
	// Optional fields
	alerting?: boolean;
	annotations?: boolean;
	autoEnabled?: boolean;
	backend?: boolean;
	buildMode?: string;
	builtIn?: boolean;
	category?: "tsdb" | "logging" | "cloud" | "tracing" | "profiling" | "sql" | "enterprise" | "iot" | "other";
	enterpriseFeatures?: EnterpriseFeatures;
	executable?: string;
	hideFromList?: boolean;
	// +listType=atomic
	includes?: Include[];
	logs?: boolean;
	metrics?: boolean;
	multiValueFilterOperators?: boolean;
	pascalName?: string;
	preload?: boolean;
	queryOptions?: QueryOptions;
	// +listType=atomic
	routes?: Route[];
	skipDataQuery?: boolean;
	state?: "alpha" | "beta";
	streaming?: boolean;
	tracing?: boolean;
	iam?: IAM;
	// +listType=atomic
	roles?: Role[];
	extensions?: Extensions;
}

export const defaultJSONData = (): JSONData => ({
	id: "",
	type: "app",
	name: "",
	info: defaultInfo(),
	dependencies: defaultDependencies(),
});

export interface Info {
	// Required fields
	// +listType=set
	keywords: string[];
	logos: {
		small: string;
		large: string;
	};
	updated: string;
	version: string;
	// Optional fields
	author?: {
		name?: string;
		email?: string;
		url?: string;
	};
	build?: {
		time?: number;
		repo?: string;
		branch?: string;
		hash?: string;
		// 		number?: number // cannot have field with this name
		pr?: number;
		build?: number;
	};
	description?: string;
	// +listType=atomic
	links?: {
		name?: string;
		url?: string;
	}[];
	// +listType=atomic
	screenshots?: {
		name?: string;
		path?: string;
	}[];
}

export const defaultInfo = (): Info => ({
	keywords: [],
	logos: {
	small: "",
	large: "",
},
	updated: "",
	version: "",
});

export interface Dependencies {
	// Required field
	grafanaDependency: string;
	// Optional fields
	grafanaVersion?: string;
	// +listType=set
	// +listMapKey=id
	plugins?: {
		id: string;
		type: "app" | "datasource" | "panel";
		name: string;
	}[];
	extensions?: {
		// +listType=set
		exposedComponents?: string[];
	};
}

export const defaultDependencies = (): Dependencies => ({
	grafanaDependency: "",
});

export interface EnterpriseFeatures {
	// Allow additional properties
	healthDiagnosticsErrors?: boolean;
}

export const defaultEnterpriseFeatures = (): EnterpriseFeatures => ({
	healthDiagnosticsErrors: false,
});

export interface Include {
	uid?: string;
	type?: "dashboard" | "page" | "panel" | "datasource";
	name?: string;
	component?: string;
	role?: "Admin" | "Editor" | "Viewer";
	action?: string;
	path?: string;
	addToNav?: boolean;
	defaultNav?: boolean;
	icon?: string;
}

export const defaultInclude = (): Include => ({
});

export interface QueryOptions {
	maxDataPoints?: boolean;
	minInterval?: boolean;
	cacheTimeout?: boolean;
}

export const defaultQueryOptions = (): QueryOptions => ({
});

export interface Route {
	path?: string;
	method?: string;
	url?: string;
	reqSignedIn?: boolean;
	reqRole?: string;
	reqAction?: string;
	// +listType=atomic
	headers?: string[];
	body?: Record<string, any>;
	tokenAuth?: {
		url?: string;
		// +listType=set
		scopes?: string[];
		params?: Record<string, any>;
	};
	jwtTokenAuth?: {
		url?: string;
		// +listType=set
		scopes?: string[];
		params?: Record<string, any>;
	};
	// +listType=atomic
	urlParams?: {
		name?: string;
		content?: string;
	}[];
}

export const defaultRoute = (): Route => ({
});

export interface IAM {
	// +listType=atomic
	permissions?: {
		action?: string;
		scope?: string;
	}[];
}

export const defaultIAM = (): IAM => ({
});

export interface Role {
	role?: {
		name?: string;
		description?: string;
		// +listType=atomic
		permissions?: {
			action?: string;
			scope?: string;
		}[];
	};
	// +listType=set
	grants?: string[];
}

export const defaultRole = (): Role => ({
});

export interface Extensions {
	// +listType=atomic
	addedComponents?: {
		// +listType=set
		targets: string[];
		title: string;
		description?: string;
	}[];
	// +listType=atomic
	addedLinks?: {
		// +listType=set
		targets: string[];
		title: string;
		description?: string;
	}[];
	// +listType=set
	// +listMapKey=id
	exposedComponents?: {
		id: string;
		title?: string;
		description?: string;
	}[];
	// +listType=set
	// +listMapKey=id
	extensionPoints?: {
		id: string;
		title?: string;
		description?: string;
	}[];
}

export const defaultExtensions = (): Extensions => ({
});

// spec is the schema of our resource
export interface Spec {
	pluginJSON: JSONData;
}

export const defaultSpec = (): Spec => ({
	pluginJSON: defaultJSONData(),
});

