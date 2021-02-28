import { ScopedVars, DataSourceApi, DataSourceInstanceSettings } from '@grafana/data';

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
   * @param name - name of the datasource plugin you want to use.
   * @param scopedVars - variables used to interpolate a templated passed as name.
   */
  get(name?: string | null, scopedVars?: ScopedVars): Promise<DataSourceApi>;

  /**
   * Get a list of data sources
   */
  getList(filters?: GetDataSourceListFilters): DataSourceInstanceSettings[];

  /**
   * Get settings and plugin metadata by name or uid
   */
  getInstanceSettings(nameOrUid: string | null | undefined): DataSourceInstanceSettings | undefined;
}

/** @public */
export interface GetDataSourceListFilters {
  /** Include mixed deta source by setting this to true */
  mixed?: boolean;

  /** Only return data sources that support metrics response */
  metrics?: boolean;

  /** Only return data sources that support tracing response */
  tracing?: boolean;

  /** Only return data sources that support annotations */
  annotations?: boolean;

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
