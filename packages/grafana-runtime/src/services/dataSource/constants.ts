export const FALLBACK_TO_LEGACY_SETTINGS_WARNING = `DataSource: getDataSourceInstanceSettings found nothing in the new cache but the legacy DataSourceSrv did — falling back`;
export const FALLBACK_TO_LEGACY_LIST_WARNING = `DataSource: getDataSourceInstanceList was empty but the legacy DataSourceSrv returned results — falling back`;
export const FALLBACK_TO_LEGACY_INSTANCE_WARNING = `DataSource: getDataSourceInstance failed via the new path but the legacy DataSourceSrv resolved it — falling back`;
export const PLUGIN_CACHE_UID_MISMATCH_WARNING = `DataSource: cached a plugin instance whose uid does not match its cache key — instance identity is wrong`;
export const NUMERIC_ID_REF_WARNING = `DataSource: resolved a data source by its numeric id — numeric ids are deprecated, pass the uid instead`;
