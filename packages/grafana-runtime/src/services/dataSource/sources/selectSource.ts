import { BootDataSource } from './bootDataSource';
import { type BootDataSourceSettings, type DataSourceCacheSource } from './types';

/**
 * The single place that decides which source fills the async data source cache. Removing a
 * source later means deleting its module and its branch here.
 */
export function createDataSourceCacheSource(boot: BootDataSourceSettings): DataSourceCacheSource {
  return new BootDataSource(boot);
}
