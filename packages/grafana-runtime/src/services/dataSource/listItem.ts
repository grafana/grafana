import { type DataSourceInstanceListItem, type DataSourceRef, type ScopedVars } from '@grafana/data';

import { isExpressionReference } from '../../utils/expressionRef';
import { getDatasourcePluginMeta, getPluginIdFromDatasourceInstanceType } from '../pluginMeta/datasources';

import { awaitFill, toListItem } from './cache';
import { getExpressionDataSourceSettings } from './expressionDs';
import { resolveRef } from './resolveRef';

/**
 * Look up a data source and return the slim {@link DataSourceInstanceListItem} — the singular
 * counterpart of `getDataSourceInstanceList`. Takes a uid, name or numeric id string, or any
 * {@link DataSourceRef}.
 *
 * Prefer it over `getDataSourceInstanceSettings` when identity and plugin metadata are enough: the
 * settings it leaves out (`jsonData`, `url`, `access`) will eventually cost a request per uid.
 *
 * - **Same ref coercions as `getDataSourceInstanceSettings`.** It mirrors the legacy
 *   `DataSourceSrv.getInstanceSettings`: a `null`, `undefined` or `'default'` ref resolves to the
 *   default data source, a type-only ref to the default of that type, and a name or numeric id to
 *   the matching instance. Prefer uids: numeric ids are going away.
 * - **Template variables** (e.g. `$ds` or `${ds}`) are interpolated with `scopedVars` on top of the
 *   global variables.
 * - **`meta` is the plugin's, not the instance's** — one cached entry per plugin. The copy on
 *   instance settings is duplicated per instance in boot data and is going away, so it serves
 *   only as a fallback for runtime-registered data sources.
 *
 * @public
 */
export async function getDataSourceInstanceListItem(
  ref?: DataSourceRef | string | null,
  scopedVars?: ScopedVars
): Promise<DataSourceInstanceListItem | undefined> {
  await awaitFill();

  const item = lookupListItem(ref, scopedVars);
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
function lookupListItem(
  ref: DataSourceRef | string | null | undefined,
  scopedVars: ScopedVars | undefined
): DataSourceInstanceListItem | undefined {
  if (isExpressionReference(ref)) {
    const settings = getExpressionDataSourceSettings();
    return settings ? toListItem(settings) : undefined;
  }
  return resolveRef(ref, scopedVars)?.item;
}
