import { getDatasourcePluginMetas } from '../../../pluginMeta/datasources';

import { fetchConnections } from './api';
import { type DataSourceConnectionWithMeta, joinConnectionsWithMetas } from './mappers';

/**
 * Every stored data source the user can read, for the views that manage data sources. Unlike the
 * data source cache, this keeps the data sources whose plugin is not installed: they have no `meta`.
 */
export async function getDataSourceConnections(): Promise<DataSourceConnectionWithMeta[]> {
  const [list, metas] = await Promise.all([fetchConnections(), getDatasourcePluginMetas()]);
  return joinConnectionsWithMetas(list?.items ?? [], metas);
}
