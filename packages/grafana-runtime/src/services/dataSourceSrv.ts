import {
  type ScopedVars,
  type DataSourceApi,
  type DataSourceInstanceSettings,
  type DataSourceRef,
} from '@grafana/data';

import { type RuntimeDataSource } from './RuntimeDataSource';

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
   * @param ref - The datasource identifier, it can be a name, UID or DataSourceRef (an object with UID),
   * @param scopedVars - variables used to interpolate a templated passed as name.
   *
   * @deprecated Use `getDataSourcePlugin` or `useDataSourcePlugin` from `@grafana/runtime` instead.
   */
  get(ref?: DataSourceRef | string | null, scopedVars?: ScopedVars): Promise<DataSourceApi>;

  /**
   * Get a list of data sources
   *
   * @deprecated Use `getInstanceSettingsList` or `useInstanceSettingsList` from `@grafana/runtime` instead.
   */
  getList(filters?: GetDataSourceListFilters): DataSourceInstanceSettings[];

  /**
   * Get settings and plugin metadata by name or uid
   *
   * @deprecated Use `getInstanceSettings` or `useInstanceSettings` from `@grafana/runtime` instead.
   */
  getInstanceSettings(
    ref?: DataSourceRef | string | null,
    scopedVars?: ScopedVars
  ): DataSourceInstanceSettings | undefined;

  /**
   * Reloads the DataSourceSrv
   *
   * @deprecated Use `reloadDataSources` from `@grafana/runtime` instead.
   */
  reload(): void;

  /**
   * Registers a runtime data source. Make sure your data source uid is unique.
   *
   * @deprecated Use `registerRuntimeDataSource` from `@grafana/runtime` instead.
   */
  registerRuntimeDataSource(entry: RuntimeDataSourceRegistration): void;
}

export interface RuntimeDataSourceRegistration {
  dataSource: RuntimeDataSource;
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
 * @deprecated Import the specific functions/hooks directly from `@grafana/runtime`
 *   (e.g. `getInstanceSettings`, `useInstanceSettingsList`, `getDataSourcePlugin`).
 *   This singleton will be removed once all callers have migrated.
 */
export function getDataSourceSrv(): DataSourceSrv {
  return singletonInstance;
}
