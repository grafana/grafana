import {
  AppEvents,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourceRef,
  DataSourceSelectItem,
  ScopedVars,
  isObject,
  matchPluginId,
} from '@grafana/data';
import {
  DataSourceSrv as DataSourceService,
  getBackendSrv,
  GetDataSourceListFilters,
  getDataSourceSrv as getDataSourceService,
  getTemplateSrv,
  RuntimeDataSourceRegistration,
  RuntimeDataSource,
  TemplateSrv,
  isExpressionReference,
} from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/internal';
import { DataQuery, DataSourceJsonData } from '@grafana/schema';
import appEvents from 'app/core/app_events';
import config from 'app/core/config';
import {
  dataSource as expressionDatasource,
  instanceSettings as expressionInstanceSettings,
} from 'app/features/expressions/ExpressionDatasource';
import { ExpressionDatasourceUID } from 'app/features/expressions/types';

import { importDataSourcePlugin } from './plugin_loader';

export class DatasourceSrv implements DataSourceService {
  private datasources: Record<string, DataSourceApi> = {}; // UID
  private settingsMapByName: Record<string, DataSourceInstanceSettings> = {};
  private settingsMapByUid: Record<string, DataSourceInstanceSettings> = {};
  private settingsMapById: Record<string, DataSourceInstanceSettings> = {};
  private runtimeDataSources: Record<string, RuntimeDataSource> = {}; //
  private defaultName = ''; // actually UID

  constructor(private templateSrv: TemplateSrv = getTemplateSrv()) {}

  init(settingsMapByName: Record<string, DataSourceInstanceSettings>, defaultName: string) {
    this.datasources = {};
    this.settingsMapByUid = {};
    this.settingsMapByName = settingsMapByName;
    this.defaultName = defaultName;

    for (const dsSettings of Object.values(settingsMapByName)) {
      if (!dsSettings.uid) {
        dsSettings.uid = dsSettings.name; // -- Grafana --, -- Mixed etc
      }

      this.settingsMapByUid[dsSettings.uid] = dsSettings;
      this.settingsMapById[dsSettings.id] = dsSettings;
    }

    for (const ds of Object.values(this.runtimeDataSources)) {
      this.datasources[ds.uid] = ds;
      this.settingsMapByUid[ds.uid] = ds.instanceSettings;
    }

    // Preload expressions
    this.datasources[ExpressionDatasourceRef.type] = expressionDatasource as DataSourceApi<
      DataQuery,
      DataSourceJsonData,
      {}
    >;
    this.datasources[ExpressionDatasourceUID] = expressionDatasource as DataSourceApi<
      DataQuery,
      DataSourceJsonData,
      {}
    >;
    this.settingsMapByUid[ExpressionDatasourceRef.uid] = expressionInstanceSettings;
    this.settingsMapByUid[ExpressionDatasourceUID] = expressionInstanceSettings;
  }

  registerRuntimeDataSource(entry: RuntimeDataSourceRegistration): void {
    if (this.runtimeDataSources[entry.dataSource.uid]) {
      throw new Error(`A runtime data source with uid ${entry.dataSource.uid} has already been registered`);
    }
    if (this.settingsMapByUid[entry.dataSource.uid]) {
      throw new Error(`A data source with uid ${entry.dataSource.uid} has already been registered`);
    }

    this.runtimeDataSources[entry.dataSource.uid] = entry.dataSource;
    this.datasources[entry.dataSource.uid] = entry.dataSource;
    this.settingsMapByUid[entry.dataSource.uid] = entry.dataSource.instanceSettings;
  }

  getDataSourceSettingsByUid(uid: string): DataSourceInstanceSettings | undefined {
    return this.settingsMapByUid[uid];
  }

  getInstanceSettings(
    ref: string | null | undefined | DataSourceRef,
    scopedVars?: ScopedVars
  ): DataSourceInstanceSettings | undefined {
    let nameOrUid = getNameOrUid(ref);

    // Expressions has a new UID as __expr__ See: https://github.com/grafana/grafana/pull/62510/
    // But we still have dashboards/panels with old expression UID (-100)
    // To support both UIDs until we migrate them all to new one, this check is necessary
    if (isExpressionReference(nameOrUid)) {
      return expressionInstanceSettings;
    }

    if (nameOrUid === 'default' || nameOrUid == null) {
      return this.settingsMapByUid[this.defaultName] ?? this.settingsMapByName[this.defaultName];
    }

    // Complex logic to support template variable data source names
    // For this we just pick the current or first data source in the variable
    if (nameOrUid[0] === '$') {
      const interpolatedName = this.templateSrv.replace(nameOrUid, scopedVars, variableInterpolation);

      let dsSettings;

      if (interpolatedName === 'default') {
        dsSettings = this.settingsMapByName[this.defaultName];
      } else {
        dsSettings = this.settingsMapByUid[interpolatedName] ?? this.settingsMapByName[interpolatedName];
      }

      if (!dsSettings) {
        return undefined;
      }

      // Return an instance with un-interpolated values for name and uid
      return {
        ...dsSettings,
        isDefault: false,
        name: nameOrUid,
        uid: nameOrUid,
        rawRef: { type: dsSettings.type, uid: dsSettings.uid },
      };
    }

    return this.settingsMapByUid[nameOrUid] ?? this.settingsMapByName[nameOrUid] ?? this.settingsMapById[nameOrUid];
  }

  get(ref?: string | DataSourceRef | null, scopedVars?: ScopedVars): Promise<DataSourceApi> {
    let nameOrUid = getNameOrUid(ref);
    if (!nameOrUid) {
      // type exists, but not the other properties
      if (isDatasourceRef(ref)) {
        const settings = this.getList({ type: ref.type });
        if (!settings?.length) {
          return Promise.reject('no datasource of type');
        }
        const ds = settings.find((v) => v.isDefault) ?? settings[0];
        return this.get(ds.uid);
      }
      return this.get(this.defaultName);
    }

    if (isExpressionReference(ref)) {
      return Promise.resolve(this.datasources[ExpressionDatasourceUID]);
    }

    // Check if nameOrUid matches a uid and then get the name
    const byName = this.settingsMapByName[nameOrUid];
    if (byName) {
      nameOrUid = byName.uid;
    }

    // This check is duplicated below, this is here mainly as performance optimization to skip interpolation
    if (this.datasources[nameOrUid]) {
      return Promise.resolve(this.datasources[nameOrUid]);
    }

    // Interpolation here is to support template variable in data source selection
    nameOrUid = this.templateSrv.replace(nameOrUid, scopedVars, variableInterpolation);

    if (nameOrUid === 'default' && this.defaultName !== 'default') {
      return this.get(this.defaultName);
    }

    if (this.datasources[nameOrUid]) {
      return Promise.resolve(this.datasources[nameOrUid]);
    }

    return this.loadDatasource(nameOrUid);
  }

  async loadDatasource(key: string): Promise<DataSourceApi> {
    if (this.datasources[key]) {
      return Promise.resolve(this.datasources[key]);
    }

    // find the metadata
    const instanceSettings = this.getInstanceSettings(key);
    if (!instanceSettings) {
      return Promise.reject({ message: `Datasource ${key} was not found` });
    }

    try {
      const dsPlugin = await importDataSourcePlugin(instanceSettings.meta);
      // check if its in cache now
      if (this.datasources[key]) {
        return this.datasources[key];
      }

      const instance = new dsPlugin.DataSourceClass(instanceSettings);

      instance.components = dsPlugin.components;

      // Some old plugins does not extend DataSourceApi so we need to manually patch them
      if (!(instance instanceof DataSourceApi)) {
        const anyInstance: any = instance;
        anyInstance.name = instanceSettings.name;
        anyInstance.id = instanceSettings.id;
        anyInstance.type = instanceSettings.type;
        anyInstance.meta = instanceSettings.meta;
        anyInstance.uid = instanceSettings.uid;
        anyInstance.getRef = DataSourceApi.prototype.getRef;
      }

      // store in instance cache
      this.datasources[key] = instance;
      this.datasources[instance.uid] = instance;
      return instance;
    } catch (err) {
      if (err instanceof Error) {
        appEvents.emit(AppEvents.alertError, [instanceSettings.name + ' plugin failed', err.toString()]);
      }
      return Promise.reject({ message: `Datasource: ${key} was not found` });
    }
  }

  getAll(): DataSourceInstanceSettings[] {
    return Object.values(this.settingsMapByName);
  }

  getList(filters: GetDataSourceListFilters = {}): DataSourceInstanceSettings[] {
    const base = Object.values(this.settingsMapByName).filter((x) => {
      if (x.meta.id === 'grafana' || x.meta.id === 'mixed' || x.meta.id === 'dashboard') {
        return false;
      }
      if (filters.metrics && !x.meta.metrics) {
        return false;
      }
      if (filters.tracing && !x.meta.tracing) {
        return false;
      }
      if (filters.logs && x.meta.category !== 'logging' && !x.meta.logs) {
        return false;
      }
      if (filters.annotations && !x.meta.annotations) {
        return false;
      }
      if (filters.alerting && !x.meta.alerting) {
        return false;
      }
      if (filters.pluginId && !matchPluginId(filters.pluginId, x.meta)) {
        return false;
      }
      if (filters.filter && !filters.filter(x)) {
        return false;
      }
      if (filters.type && (Array.isArray(filters.type) ? !filters.type.includes(x.type) : filters.type !== x.type)) {
        return false;
      }
      if (
        !filters.all &&
        x.meta.metrics !== true &&
        x.meta.annotations !== true &&
        x.meta.tracing !== true &&
        x.meta.logs !== true &&
        x.meta.alerting !== true
      ) {
        return false;
      }
      return true;
    });

    if (filters.variables) {
      for (const variable of this.templateSrv.getVariables()) {
        if (variable.type !== 'datasource') {
          continue;
        }
        let dsValue = variable.current.value === 'default' ? this.defaultName : variable.current.value;
        // Support for multi-value DataSource (ds) variables
        if (Array.isArray(dsValue)) {
          // If the ds variable have multiple selected datasources
          // We will use the first one
          dsValue = dsValue[0];
        }
        const dsSettings =
          !Array.isArray(dsValue) && (this.settingsMapByName[dsValue] || this.settingsMapByUid[dsValue]);

        if (dsSettings) {
          const key = `$\{${variable.name}\}`;
          base.push({
            ...dsSettings,
            isDefault: false,
            name: key,
            uid: key,
          });
        }
      }
    }

    const sorted = base.sort((a, b) => {
      if (a.name.toLowerCase() > b.name.toLowerCase()) {
        return 1;
      }
      if (a.name.toLowerCase() < b.name.toLowerCase()) {
        return -1;
      }
      return 0;
    });

    if (!filters.pluginId && !filters.alerting) {
      if (filters.mixed) {
        const mixedInstanceSettings = this.getInstanceSettings('-- Mixed --');
        if (mixedInstanceSettings) {
          base.push(mixedInstanceSettings);
        }
      }

      if (filters.dashboard) {
        const dashboardInstanceSettings = this.getInstanceSettings('-- Dashboard --');
        if (dashboardInstanceSettings) {
          base.push(dashboardInstanceSettings);
        }
      }

      if (!filters.tracing) {
        const grafanaInstanceSettings = this.getInstanceSettings('-- Grafana --');
        if (grafanaInstanceSettings && filters.filter?.(grafanaInstanceSettings) !== false) {
          base.push(grafanaInstanceSettings);
        }
      }
    }

    return sorted;
  }

  /**
   * @deprecated use getList
   * */
  getExternal(): DataSourceInstanceSettings[] {
    return this.getList();
  }

  /**
   * @deprecated use getList
   * */
  getAnnotationSources() {
    return this.getList({ annotations: true, variables: true }).map((x) => {
      return {
        name: x.name,
        value: x.name,
        meta: x.meta,
      };
    });
  }

  /**
   * @deprecated use getList
   * */
  getMetricSources(options?: { skipVariables?: boolean }): DataSourceSelectItem[] {
    return this.getList({ metrics: true, variables: !options?.skipVariables }).map((x) => {
      return {
        name: x.name,
        value: x.name,
        meta: x.meta,
      };
    });
  }

  async reload() {
    const settings = await getBackendSrv().get('/api/frontend/settings');
    config.datasources = settings.datasources;
    config.defaultDatasource = settings.defaultDatasource;
    this.init(settings.datasources, settings.defaultDatasource);
  }
}

export function getNameOrUid(ref?: string | DataSourceRef | null): string | undefined {
  if (isExpressionReference(ref)) {
    return ExpressionDatasourceRef.uid;
  }

  const isString = typeof ref === 'string';
  return isString ? ref : ref?.uid;
}

export function variableInterpolation<T>(value: T | T[]) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

const isDatasourceRef = (ref: string | DataSourceRef | null | undefined): ref is DataSourceRef => {
  if (ref && isObject(ref) && 'type' in ref) {
    return true;
  }
  return false;
};

export const getDatasourceSrv = (): DatasourceSrv => {
  return getDataSourceService() as DatasourceSrv;
};
