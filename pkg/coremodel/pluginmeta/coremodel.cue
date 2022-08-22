package pluginmeta

import (
	"strings"

	"github.com/grafana/thema"
)

thema.#Lineage
name: "pluginmeta"
seqs: [
	{
		schemas: [
			{
				// Unique name of the plugin. If the plugin is published on
				// grafana.com, then the plugin id has to follow the naming
				// conventions.
				id: string & strings.MinRunes(1)
				id: =~"^([0-9a-z]+\\-([0-9a-z]+\\-)?(\(strings.Join([for t in _types {t}], "|"))))|(alertGroups|alertlist|annolist|barchart|bargauge|candlestick|canvas|dashlist|debug|gauge|geomap|gettingstarted|graph|heatmap|heatmap-old|histogram|icon|live|logs|news|nodeGraph|piechart|pluginlist|stat|state-timeline|status-history|table|table-old|text|timeseries|traces|welcome|xychart|alertmanager|cloudwatch|dashboard|elasticsearch|grafana|grafana-azure-monitor-datasource|graphite|influxdb|jaeger|loki|mixed|mssql|mysql|opentsdb|postgres|prometheus|stackdriver|tempo|testdata|zipkin)$"

				// The set of all plugin types. This hidden field exists solely
				// so that the set can be string-interpolated into other fields.
				_types: ["app", "datasource", "panel", "renderer", "secretsmanager"]

				// type indicates which type of Grafana plugin this is, of the defined
				// set of Grafana plugin types.
				type: or(_types)

				// IncludeType is a string identifier of a plugin include type, which is
				// a superset of plugin types.
				#IncludeType: type | "dashboard" | "page"

				// Human-readable name of the plugin that is shown to the user in
				// the UI.
				name: string

				// Plugin category used on the Add data source page.
				category?: "tsdb" | "logging" | "cloud" | "tracing" | "sql" | "enterprise" | "other"

				// For data source plugins, if the plugin supports annotation
				// queries.
				annotations?: bool

				// For data source plugins, if the plugin supports alerting.
				alerting?: bool

				// If the plugin has a backend component.
				backend?: bool

				// builtin indicates whether the plugin is developed and shipped as part
				// of Grafana. Also known as a "core plugin."
				builtIn: bool | *false

				// hideFromList excludes the plugin from listings in Grafana's UI. Only
				// allowed for builtin plugins.
				hideFromList: bool | *false

				// The first part of the file name of the backend component
				// executable. There can be multiple executables built for
				// different operating system and architecture. Grafana will
				// check for executables named `<executable>_<$GOOS>_<lower case
				// $GOARCH><.exe for Windows>`, e.g. `plugin_linux_amd64`.
				// Combination of $GOOS and $GOARCH can be found here:
				// https://golang.org/doc/install/source#environment.
				executable?: string

				// Initialize plugin on startup. By default, the plugin
				// initializes on first use.
				preload?: bool

				// Marks a plugin as a pre-release.
				state?: #ReleaseState

				// ReleaseState indicates release maturity state of a plugin.
				#ReleaseState: "alpha" | "beta" | "deprecated" | *"stable"

				// Resources to include in plugin.
				includes?: [...#Include]

				// A resource to be included in a plugin.
				#Include: {
					// Unique identifier of the included resource
					uid?:  string
					type:  #IncludeType
					name?: string

					// (Legacy) The Angular component to use for a page.
					component?: string
					role?:      "Admin" | "Editor" | "Viewer"

					// Used for app plugins.
					path?: string

					// Add the include to the side menu.
					addToNav?: bool

					// Page or dashboard when user clicks the icon in the side menu.
					defaultNav?: bool

					// Icon to use in the side menu. For information on available
					// icon, refer to [Icons
					// Overview](https://developers.grafana.com/ui/latest/index.html?path=/story/docs-overview-icon--icons-overview).
					icon?: string
					...
				}

				// For data source plugins, if the plugin supports logs.
				logs?: bool

				// For panel plugins. Hides the query editor.
				skipDataQuery?: bool

				// For data source plugins, if the plugin supports metric queries.
				// Used in Explore.
				metrics?: bool

				// For data source plugins, if the plugin supports streaming.
				streaming?: bool

				// This is an undocumented feature.
				tables?: bool

				// For data source plugins, if the plugin supports tracing.
				tracing?: bool

				// For data source plugins, include hidden queries in the data
				// request.
				hiddenQueries?: bool

				// Set to true for app plugins that should be enabled by default
				// in all orgs
				autoEnabled?: bool

				// Dependencies needed by the plugin.
				dependencies: #Dependencies

				#Dependencies: {
					// (Deprecated) Required Grafana version for this plugin, e.g.
					// `6.x.x 7.x.x` to denote plugin requires Grafana v6.x.x or
					// v7.x.x.
					grafanaVersion?: =~"^([0-9]+)(\\.[0-9x]+)?(\\.[0-9x])?$"

					// Required Grafana version for this plugin. Validated using
					// https://github.com/npm/node-semver.
					grafanaDependency: =~"^(<=|>=|<|>|=|~|\\^)?([0-9]+)(\\.[0-9x\\*]+)(\\.[0-9x\\*])?(\\s(<=|>=|<|=>)?([0-9]+)(\\.[0-9x]+)(\\.[0-9x]))?$"

					// An array of required plugins on which this plugin depends.
					plugins?: [...#Dependency]
				}

				// Dependency describes another plugin on which a plugin depends.
				// The id refers to the plugin package identifier, as given on
				// the grafana.com plugin marketplace.
				#Dependency: {
					id:      =~"^[0-9a-z]+\\-([0-9a-z]+\\-)?(app|panel|datasource)$"
					type:    "app" | "datasource" | "panel"
					name:    string
					version: string
					...
				}

				// Metadata about the plugin.
				info: #Info

				// Metadata about a Grafana plugin. Some fields are used on the plugins
				// page in Grafana and others on grafana.com, if the plugin is published.
				#Info: {
					// Information about the plugin author.
					author?: {
						// Author's name.
						name?: string

						// Author's name.
						email?: string

						// Link to author's website.
						url?: string
					}

					// Build information
					build?: #BuildInfo

					// Description of plugin. Used on the plugins page in Grafana and
					// for search on grafana.com.
					description?: string

					// Array of plugin keywords. Used for search on grafana.com.
					keywords: [...string]
					// should be this, but CUE to openapi converter screws this up
					// by inserting a non-concrete default.
					// keywords: [string, ...string]

					// An array of link objects to be displayed on this plugin's
					// project page in the form `{name: 'foo', url:
					// 'http://example.com'}`
					links?: [...{
						name?: string
						url?:  string
					}]

					// SVG images that are used as plugin icons.
					logos?: {
						// Link to the "small" version of the plugin logo, which must be
						// an SVG image. "Large" and "small" logos can be the same image.
						small: string

						// Link to the "large" version of the plugin logo, which must be
						// an SVG image. "Large" and "small" logos can be the same image.
						large: string
					}

					// An array of screenshot objects in the form `{name: 'bar', path:
					// 'img/screenshot.png'}`
					screenshots?: [...{
						name?: string
						path?: string
					}]

					// Date when this plugin was built.
					updated?: =~"^(\\d{4}-\\d{2}-\\d{2}|\\%TODAY\\%)$"

					// Project version of this commit, e.g. `6.7.x`.
					version?: =~"^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*$|\\%VERSION\\%)"
				}

				#BuildInfo: {
					// Time when the plugin was built, as a Unix timestamp.
					time?: int64
					repo?: string

					// Git branch the plugin was built from.
					branch?: string

					// Git hash of the commit the plugin was built from
					hash?:     string
					"number"?: int64

					// GitHub pull request the plugin was built from
					pr?: int32
				}

				// For data source plugins. There is a query options section in
				// the plugin's query editor and these options can be turned on
				// if needed.
				queryOptions?: {
					// For data source plugins. If the `max data points` option should
					// be shown in the query options section in the query editor.
					maxDataPoints?: bool

					// For data source plugins. If the `min interval` option should be
					// shown in the query options section in the query editor.
					minInterval?: bool

					// For data source plugins. If the `cache timeout` option should
					// be shown in the query options section in the query editor.
					cacheTimeout?: bool
				}

				// Routes is a list of proxy routes, if any. For datasource plugins only.
				routes?: [...#Route]

				// Header describes an HTTP header that is forwarded with a proxied request for
				// a plugin route.
				#Header: {
					name:    string
					content: string
				}

				// URLParam describes query string parameters for
				// a url in a plugin route
				#URLParam: {
					name:    string
					content: string
				}

				// A proxy route used in datasource plugins for plugin authentication
				// and adding headers to HTTP requests made by the plugin.
				// For more information, refer to [Authentication for data source
				// plugins](https://grafana.com/docs/grafana/latest/developers/plugins/authentication/).
				#Route: {
					// For data source plugins. The route path that is replaced by the
					// route URL field when proxying the call.
					path?: string

					// For data source plugins. Route method matches the HTTP verb
					// like GET or POST. Multiple methods can be provided as a
					// comma-separated list.
					method?: string

					// For data source plugins. Route URL is where the request is
					// proxied to.
					url?: string

					urlParams?: [...#URLParam]
					reqSignedIn?: bool
					reqRole?:     string

					// For data source plugins. Route headers adds HTTP headers to the
					// proxied request.
					headers?: [...#Header]

					// For data source plugins. Route headers set the body content and
					// length to the proxied request.
					body?: {
						...
					}

					// For data source plugins. Token authentication section used with
					// an OAuth API.
					tokenAuth?: #TokenAuth

					// For data source plugins. Token authentication section used with
					// an JWT OAuth API.
					jwtTokenAuth?: #JWTTokenAuth
				}

				// TODO docs
				#TokenAuth: {
					// URL to fetch the authentication token.
					url?: string

					// The list of scopes that your application should be granted
					// access to.
					scopes?: [...string]

					// Parameters for the token authentication request.
					params: [string]: string
				}

				// TODO docs
				// TODO should this really be separate from TokenAuth?
				#JWTTokenAuth: {
					// URL to fetch the JWT token.
					url: string

					// The list of scopes that your application should be granted
					// access to.
					scopes: [...string]

					// Parameters for the JWT token authentication request.
					params: [string]: string
				}

				// Grafana Enerprise specific features.
				enterpriseFeatures?: {
					// Enable/Disable health diagnostics errors. Requires Grafana
					// >=7.5.5.
					healthDiagnosticsErrors?: bool | *false
					...
				}
			},
		]
	},
]
