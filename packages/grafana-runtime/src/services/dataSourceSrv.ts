import { ScopedVars, DataSourceApi } from '@grafana/data';

/**
 * Used to retrieve the {@link DataSourceSrv} that can be used to
 *
 * @public
 */
export interface DataSourceSrv {
  get(name?: string, scopedVars?: ScopedVars): Promise<DataSourceApi>;
}

let singletonInstance: DataSourceSrv;

/**
 * Used during startup by Grafana to set the DataSourceSrv so it is available
 * via the the {@link getDataSourceSrv()} to the rest of the application.
 *
 * @internal
 */
export function setDataSourceSrv(instance: DataSourceSrv) {
  singletonInstance = instance;
}

/**
 * Used to retrieve the {@link DataSourceSrv} that can be used to
 *
 * @public
 */
export function getDataSourceSrv(): DataSourceSrv {
  return singletonInstance;
}
