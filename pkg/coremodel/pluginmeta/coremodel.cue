package pluginmeta

import "github.com/grafana/thema"

thema.#Lineage
name: "pluginmeta"
seqs: [
	{
		schemas: [
			{
				// Unique name of the plugin. If the plugin is published on
				// grafana.com, then the plugin id has to follow the naming
				// conventions.
				id: =~"^[0-9a-z]+\\-([0-9a-z]+\\-)?(app|panel|datasource)$"

				// Plugin type.
				type: "app" | "datasource" | "panel"

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
				state?: "alpha" | "beta"

				// Resources to include in plugin.
				includes?: [...{
					// Unique identifier of the included resource
					uid?:  string
					type?: "dashboard" | "page" | "panel" | "datasource"
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
				}]

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
				dependencies: {
					// (Deprecated) Required Grafana version for this plugin, e.g.
					// `6.x.x 7.x.x` to denote plugin requires Grafana v6.x.x or
					// v7.x.x.
					grafanaVersion?: =~"^([0-9]+)(\\.[0-9x]+)?(\\.[0-9x])?$"

					// Required Grafana version for this plugin. Validated using
					// https://github.com/npm/node-semver.
					grafanaDependency: =~"^(<=|>=|<|>|=|~|\\^)?([0-9]+)(\\.[0-9x\\*]+)(\\.[0-9x\\*])?(\\s(<=|>=|<|=>)?([0-9]+)(\\.[0-9x]+)(\\.[0-9x]))?$"

					// An array of required plugins on which this plugin depends.
					plugins?: [...{
						id:      =~"^[0-9a-z]+\\-([0-9a-z]+\\-)?(app|panel|datasource)$"
						type:    "app" | "datasource" | "panel"
						name:    string
						version: string
						...
					}]
				}

				// Metadata for the plugin. Some fields are used on the plugins
				// page in Grafana and others on grafana.com if the plugin is
				// published.
				info: {
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
					build?: {
						// Time when the plugin was built, as a Unix timestamp.
						time?: number
						repo?: string

						// Git branch the plugin was built from.
						branch?: string

						// Git hash of the commit the plugin was built from
						hash?:   string
						numberr?: number

						// GitHub pull request the plugin was built from
						pr?: number
					}

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
					logos: {
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
					updated: =~"^(\\d{4}-\\d{2}-\\d{2}|\\%TODAY\\%)$"

					// Project version of this commit, e.g. `6.7.x`.
					version: =~"^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*$|\\%VERSION\\%)"
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

				// For data source plugins. Proxy routes used for plugin
				// authentication and adding headers to HTTP requests made by the
				// plugin. For more information, refer to [Authentication for
				// data source
				// plugins](https://grafana.com/docs/grafana/latest/developers/plugins/authentication/).
				routes?: [...{
					// For data source plugins. The route path that is replaced by the
					// route URL field when proxying the call.
					path?: string

					// For data source plugins. Route method matches the HTTP verb
					// like GET or POST. Multiple methods can be provided as a
					// comma-separated list.
					method?: string

					// For data source plugins. Route URL is where the request is
					// proxied to.
					url?:         string
					reqSignedIn?: bool
					reqRole?:     string

					// For data source plugins. Route headers adds HTTP headers to the
					// proxied request.
					headers?: [...]

					// For data source plugins. Route headers set the body content and
					// length to the proxied request.
					body?: {
						...
					}

					// For data source plugins. Token authentication section used with
					// an OAuth API.
					tokenAuth?: {
						// URL to fetch the authentication token.
						url?: string

						// The list of scopes that your application should be granted
						// access to.
						scopes?: [...string]

						// Parameters for the token authentication request.
						params?: {
							// OAuth grant type
							grant_type?: string

							// OAuth client ID
							client_id?: string

							// OAuth client secret. Usually populated by decrypting the secret
							// from the SecureJson blob.
							client_secret?: string

							// OAuth resource
							resource?: string
						}
					}

					// For data source plugins. Token authentication section used with
					// an JWT OAuth API.
					jwtTokenAuth?: {
						// URL to fetch the JWT token.
						url?: string

						// The list of scopes that your application should be granted
						// access to.
						scopes?: [...string]

						// Parameters for the JWT token authentication request.
						params?: {
							token_uri?:    string
							client_email?: string
							private_key?:  string
						}
					}
				}]

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
