package common

// TODO docs
PluginMeta: {
	id: string
  name: string
  type: PluginType
  info: PluginMetaInfo
  includes?: [...PluginInclude]
  state?: PluginState

  // System.load & relative URLS
  module: string
  baseUrl: string

  // Define plugin requirements
  dependencies?: PluginDependencies

  // Filled in by the backend
  jsonData?: _
  secureJsonData?: {...}
  secureJsonFields?: [string]:bool
  enabled?: bool
  defaultNavUrl?: string
  hasUpdate?: bool
  enterprise?: bool
  latestVersion?: string
  pinned?: bool
  signature?: PluginSignatureStatus
  signatureType?: PluginSignatureType
  signatureOrg?: string
  live?: bool
} @cuetsy(kind="interface")

// Describes {@link https://grafana.com/docs/grafana/latest/plugins | type of plugin}
PluginType: "panel" | "datasource" | "app" | "renderer" |  "secretsmanager" @cuetsy(kind="enum",memberNames="panel|datasource|app|renderer|secretsmanager")

// TODO docs
PluginMetaInfo: {
  author: {
    name: string
    url?: string
  }
  description: string
  links: [...PluginMetaInfoLink]
  logos: {
    large: string
    small: string
  }
  build?: [...PluginBuildInfo]
  screenshots: [...ScreenshotInfo]
  updated: string
  version: string
}

PluginMetaInfoLink: {
  name: string
  url: string
} @cuetsy(kind="interface")

PluginBuildInfo: {
  time?: int64
  repo?: string
  branch?: string
  hash?: string
  number?: int64
  pr?: int64
} @cuetsy(kind="interface")

ScreenshotInfo: {
  name: string
  path: string
} @cuetsy(kind="interface")

// TODO docs
PluginIncludeType: "dashboard" | "page" | "panel" | "datasource" @cuetsy(kind="enum",memberNames="dashboard|page|panel|datasource")

// TODO docs
PluginInclude: {
  type: PluginIncludeType
  name: string
  path?: string
  icon?: string
  // "Admin", "Editor" or "Viewer". If set then the include will only show up in the navigation if the user has the required roles.
  role?: string
  // Adds the "page" or "dashboard" type includes to the navigation if set to `true`.
  addToNav?: bool
  // Angular app pages
  component?: string
} @cuetsy(kind="interface")

// alpha - Only included if `enable_alpha` config option is true
// beta - Will show a warning banner
// stable - Will not show anything
// deprecated - Will continue to work -- but not show up in the options to add
PluginState: "alpha" | "beta" | "stable" | "deprecated" @cuetsy(kind="enum",memberNames="alpha|beta|stable|deprecated")

// TODO docs
PluginDependencies: {
  grafanaDependency?: string
  grafanaVersion: string
  plugins: [...PluginDependencyInfo]
} @cuetsy(kind="interface")

// TODO docs
PluginDependencyInfo: {
  id: string
  name: string
  version: string
  type: PluginType
} @cuetsy(kind="interface")

// Describes status of {@link https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/ | plugin signature}
// internal - core plugin, no signature
// valid - signed and accurate MANIFEST
// invalid - invalid signature
// modified - valid signature, but content mismatch
// missing - missing signature file
PluginSignatureStatus: "internal" | "valid" | "invalid" | "modified" | "missing" @cuetsy(kind="enum",memberNames="internal|valid|invalid|modified|missing")

// Describes level of {@link https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/#plugin-signature-levels/ | plugin signature level}
PluginSignatureType: "grafana" | "commercial" | "community" | "private" | "core" @cuetsy(kind="enum",memberNames="grafana|commercial|community|private|core")
