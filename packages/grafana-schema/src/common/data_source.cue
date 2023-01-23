package common

DataSourceJsonData: {
  authType?: string
  defaultRegion?: string
  profile?: string
  manageAlerts?: bool
  alertmanagerUid?: string
} @cuetsy(kind="interface")

// Frontend settings model that is passed to Datasource constructor. This differs a bit from the model above
// as this data model is available to every user who has access to a data source (Viewers+).  This is loaded
// in bootData (on page load), or from: /api/frontend/settings
// TODO <T extends DataSourceJsonData = DataSourceJsonData>
DataSourceInstanceSettings: {
	id: int64
  uid: string
  type: string
  name: string
  meta: DataSourcePluginMeta
  readOnly: bool
  url?: string
  jsonData: _
  username?: string
  // when access is direct, for some legacy datasources
  password?: string
  //  @deprecated -- use jsonData to store information related to database.
  // This field should only be used by Elasticsearch and Influxdb.
  database?: string
  isDefault?: bool
  // Currently we support 2 options - direct (browser) and proxy (server)
  access: 'direct' | 'proxy' @cuetsy(kind="type")
  // This is the full Authorization header if basic auth is enabled.
  // Only available here when access is Browser (direct), when access is Server (proxy)
  // The basic auth header, username & password is never exposed to browser/Frontend
  // so this will be empty then.
  basicAuth?: string
  withCredentials?: bool
  // When the name+uid are based on template variables, maintain access to the real values
  rawRef?: DataSourceRef
} @cuetsy(kind="interface")

// TODO docs | <T extends KeyValue = {}> extends PluginMeta<T>
DataSourcePluginMeta: {
	builtIn?: bool
  metrics?: bool
  logs?: bool
  annotations?: bool
  alerting?: bool
  tracing?: bool
  mixed?: bool
  hasQueryHelp?: bool
  category?: string
  queryOptions?: PluginMetaQueryOptions
  sort?: number
  streaming?: bool
  unlicensed?: bool
  backend?: bool
  isBackend?: bool
} @cuetsy(kind="interface")

PluginMetaQueryOptions: {
  cacheTimeout?: bool
  maxDataPoints?: bool
  minInterval?: bool
} @cuetsy(kind="interface")
