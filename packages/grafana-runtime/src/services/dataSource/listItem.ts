import { type DataSourceInstanceListItem, type DataSourceRef } from '@grafana/data';

import { getDatasourcePluginMeta, getPluginIdFromDatasourceInstanceType } from '../pluginMeta/datasources';

import { lookupByUid, toListItem } from './settings';

/**
 * Look up a data source **by uid** and return the slim {@link DataSourceInstanceListItem} —
 * the singular counterpart of `getDataSourceInstanceList`. Takes a uid string or any
 * {@link DataSourceRef} carrying one.
 *
 * Prefer it over `getDataSourceInstanceSettings` when `type`, `name`, `meta`, `readOnly` and
 * `isDefault` are all you need: the settings it leaves out (`jsonData`, `url`, `access`,
 * `apiVersion`) will eventually cost a request per uid.
 *
 * - **uid or nothing.** No name or numeric-id fallback, no `'default'`, no type-only refs, no
 *   `${ds}` interpolation — interpolate first. Anything else returns `undefined`.
 *   `getDataSourceInstanceSettings` coerces all of those; it mirrors the legacy
 *   `DataSourceSrv.getInstanceSettings`. This does not.
 * - **`meta` is the plugin's, not the instance's** — one cached entry per plugin. The copy on
 *   instance settings is duplicated per instance in boot data and is going away, so it serves
 *   only as a fallback for runtime-registered data sources.
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
