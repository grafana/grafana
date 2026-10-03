import { type DataSourceInstanceListItem, type DataSourceRef } from '@grafana/data';

import { isExpressionReference } from '../../utils/expressionRef';
import { getDatasourcePluginMeta, getPluginIdFromDatasourceInstanceType } from '../pluginMeta/datasources';

import { awaitFill, getListItemByUid, toListItem } from './cache';
import { getExpressionDataSourceSettings } from './expressionDs';

/**
 * Look up a data source **by uid** and return the slim {@link DataSourceInstanceListItem} —
 * the singular counterpart of `getDataSourceInstanceList`. Takes a uid string or any
 * {@link DataSourceRef} carrying one.
 *
 * Prefer it over `getDataSourceInstanceSettings` when `type`, `apiVersion`, `name`, `meta` and
 * `isDefault` are all you need: the settings it leaves out (`jsonData`, `url`, `access`) will
 * eventually cost a request per uid.
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

  await awaitFill();

  const item = lookupListItem(uid);
  if (!item) {
    return undefined;
  }

  // Built-ins report the plugin *type* as their instance type, so the plugin id has to be
  // derived from the name before the plugin meta cache can be queried.
  const pluginId = getPluginIdFromDatasourceInstanceType(item.type, item.name);
  const meta = await getDatasourcePluginMeta(pluginId);

  return meta ? { ...item, meta } : item;
}

// Expressions are included because `__expr__` (and the legacy `-100`) is the uid they are
// registered under; they sit outside the list layer only because they are set at boot.
function lookupListItem(uid: string): DataSourceInstanceListItem | undefined {
  if (isExpressionReference(uid)) {
    const settings = getExpressionDataSourceSettings();
    return settings ? toListItem(settings) : undefined;
  }
  return getListItemByUid(uid);
}
