import { type DataSourcePluginMeta, type DataSourceRef } from '@grafana/data';

import { getDatasourcePluginMeta, getPluginIdFromDatasourceInstanceType } from '../pluginMeta/datasources';

import { getDataSourceInstanceListItem } from './settings';

/**
 * Resolve the *plugin* metadata for a data source *instance*: logo, capability flags
 * (`metrics`/`logs`/`alerting`/`streaming`), module URL, category.
 *
 * Prefer this over reading `meta` off `getDataSourceInstanceSettings` — the meta on instance
 * settings is a per-instance copy that will stop being shipped, while this reads the single
 * cached entry per plugin. Note the returned `type` is the plugin *type* (`'datasource'`); for
 * the instance type use `getDataSourceInstanceType`.
 *
 * Accepts a uid, a name, a stringified id or a {@link DataSourceRef}. As with the other APIs in
 * this module, a `null`/`undefined`/`'default'` ref resolves the **default** data source — pass
 * a concrete ref if that is not what you want.
 *
 * @public
 */
export async function getDataSourceInstanceMeta(
  ref?: DataSourceRef | string | null
): Promise<DataSourcePluginMeta | undefined> {
  const item = await getDataSourceInstanceListItem(ref);
  if (!item) {
    return undefined;
  }

  const pluginId = getPluginIdFromDatasourceInstanceType(item.type, item.name);
  const meta = await getDatasourcePluginMeta(pluginId);

  // Runtime-registered data sources are not in the plugin meta map, so fall back to the
  // meta carried on the instance — the same fallback DatasourceSrv.loadDatasource makes.
  return meta ?? item.meta;
}
