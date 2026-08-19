import { type DataSourceInstanceListItem, type DataSourceRef, type ScopedVars } from '@grafana/data';

import { getDatasourcePluginMeta, getPluginIdFromDatasourceInstanceType } from '../pluginMeta/datasources';

import { getDataSourceInstanceSettings, toListItem } from './settings';

/**
 * Resolve a data source to the slim {@link DataSourceInstanceListItem} shape — the singular
 * counterpart of {@link getDataSourceInstanceList}. Accepts a uid, a name, a stringified id or
 * a {@link DataSourceRef}.
 *
 * Prefer this over {@link getDataSourceInstanceSettings} whenever only identity or plugin
 * metadata is needed (`type`, `name`, `meta`, `readOnly`, `isDefault`). The per-instance
 * settings — `jsonData`, `url`, `access`, `apiVersion` — will eventually be fetched on demand
 * per uid, so callers that avoid them keep working without a request.
 *
 * `meta` is read from the plugin meta cache (one entry per plugin) rather than the copy
 * embedded on the instance settings, which is duplicated per instance in boot data and is
 * meant to go away. The instance copy is used only as a fallback, for runtime-registered
 * data sources that have no entry in that cache.
 *
 * A `null`/`undefined`/`'default'` ref resolves the **default** data source — pass a concrete
 * ref if that is not what you want.
 *
 * @public
 */
export async function getDataSourceInstanceListItem(
  ref?: DataSourceRef | string | null,
  scopedVars?: ScopedVars
): Promise<DataSourceInstanceListItem | undefined> {
  // Delegating to getDataSourceInstanceSettings is only valid while that is a synchronous read
  // of the boot-data map. Once it fetches per-instance settings from the backend this becomes
  // one request per data source — reimplement over the getDataSourceInstanceList cache, whose
  // items already carry uid, type and name.
  const settings = await getDataSourceInstanceSettings(ref, scopedVars);
  if (!settings) {
    return undefined;
  }

  const item = toListItem(settings);
  // Built-ins report the plugin *type* as their instance type, so the plugin id has to be
  // derived from the name before the plugin meta cache can be queried.
  const pluginId = getPluginIdFromDatasourceInstanceType(item.type, item.name);
  const meta = await getDatasourcePluginMeta(pluginId);

  return meta ? { ...item, meta } : item;
}
