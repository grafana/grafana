import { ScopedVars, DataSourceApi, DataSourceInstanceSettings, DataSourceRef } from '@grafana/data';

/**
 * This is the entry point for communicating with a datasource that is added as
 * a plugin (both external and internal). Via this service you will get access
 * to the {@link @grafana/data#DataSourceApi | DataSourceApi} that have a rich API for
 * communicating with the datasource.
 *
 * @public
 */
export interface DataSourceSrv {
  /**
   * Returns the requested dataSource. If it cannot be found it rejects the promise.
   * @param ref - The datasource identifier, typically an object with UID and type,
   * @param scopedVars - variables used to interpolate a templated passed as name.
   */
  get(ref?: DataSourceRef | string | null, scopedVars?: ScopedVars): Promise<DataSourceApi>;

  /**
   * Get a list of data sources
   */
  getList(filters?: GetDataSourceListFilters): DataSourceInstanceSettings[];

  /**
   * Get settings and plugin metadata by name or uid
   */
  getInstanceSettings(
    ref?: DataSourceRef | string | null,
    scopedVars?: ScopedVars
  ): DataSourceInstanceSettings | undefined;

  /**
   * Reloads the DataSourceSrv
   */
  reload(): void;
}

/** @public */
export interface GetDataSourceListFilters {
  /** Include mixed data source by setting this to true */
  mixed?: boolean;

  /** Only return data sources that support metrics response */
  metrics?: boolean;

  /** Only return data sources that support tracing response */
  tracing?: boolean;

  /** Only return data sources that support logging response */
  logs?: boolean;

  /** Only return data sources that support annotations */
  annotations?: boolean;

  /** Only filter data sources that support alerting */
  alerting?: boolean;

  /**
   * By default only data sources that can be queried will be returned. Meaning they have tracing,
   * metrics, logs or annotations flag set in plugin.json file
   * */
  all?: boolean;

  /** Set to true to return dashboard data source */
  dashboard?: boolean;

  /** Set to true to return data source variables */
  variables?: boolean;

  /** filter list by plugin  */
  pluginId?: string;

  /** apply a function to filter */
  filter?: (dataSource: DataSourceInstanceSettings) => boolean;

  /** Only returns datasources matching the specified types (ie. Loki, Prometheus) */
  type?: string | string[];
}

let singletonInstance: DataSourceSrv;

/**
 * Used during startup by Grafana to set the DataSourceSrv so it is available
 * via the {@link getDataSourceSrv} to the rest of the application.
 *
 * @internal
 */
export function setDataSourceSrv(instance: DataSourceSrv) {
  singletonInstance = instance;
}

/**
 * Used to retrieve the {@link DataSourceSrv} that is the entry point for communicating with
 * a datasource that is added as a plugin (both external and internal).
 *
 * @public
 */
export function getDataSourceSrv(): DataSourceSrv {
  return singletonInstance;
}
