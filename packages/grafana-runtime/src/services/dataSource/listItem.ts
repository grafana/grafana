import { type DataSourceInstanceListItem, type DataSourceRef } from '@grafana/data';

import { getDatasourcePluginMeta, getPluginIdFromDatasourceInstanceType } from '../pluginMeta/datasources';

import { lookupByUid, toListItem } from './settings';

/**
 * Resolve a data source **by uid** to the slim {@link DataSourceInstanceListItem} shape — the
 * singular counterpart of {@link getDataSourceInstanceList}. Accepts a uid string or any
 * {@link DataSourceRef} carrying one.
 *
 * This is a plain uid lookup and nothing else. Unlike {@link getDataSourceInstanceSettings} —
 * which mirrors the legacy `DataSourceSrv.getInstanceSettings` — it does **not** fall back to
 * matching on name or numeric id, does not resolve `'default'`/`undefined` to the default data
 * source, does not resolve a type-only ref to the default of that type, and does not interpolate
 * template variables. Anything without a usable uid returns `undefined`; interpolate `${ds}`
 * refs before calling.
 *
 * Prefer this over {@link getDataSourceInstanceSettings} whenever only identity or plugin
 * metadata is needed (`type`, `name`, `meta`, `readOnly`, `isDefault`). The per-instance
 * settings — `jsonData`, `url`, `access`, `apiVersion` — will eventually be fetched on demand
 * per uid, so callers that avoid them keep working without a request.
 *
 * `meta` is read from the plugin meta cache (one entry per plugin) rather than the copy embedded
 * on the instance settings, which is duplicated per instance in boot data and is meant to go
 * away. The instance copy is used only as a fallback, for runtime-registered data sources that
 * have no entry in that cache.
 *
 * @public
 */
export async function getDataSourceInstanceListItem(
  ref?: DataSourceRef | string | null
): Promise<DataSourceInstanceListItem | undefined> {
  const uid = typeof ref === 'string' ? ref : ref?.uid;
  if (!uid) {
    return undefined;
  }

  const settings = lookupByUid(uid);
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
