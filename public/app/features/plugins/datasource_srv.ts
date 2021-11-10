// Services & Utils
import { importDataSourcePlugin } from './plugin_loader';
import {
  GetDataSourceListFilters,
  DataSourceSrv as DataSourceService,
  getDataSourceSrv as getDataSourceService,
  TemplateSrv,
  getTemplateSrv,
} from '@grafana/runtime';
// Types
import {
  AppEvents,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourceRef,
  DataSourceSelectItem,
  ScopedVars,
} from '@grafana/data';
// Pretend Datasource
import {
  dataSource as expressionDatasource,
  ExpressionDatasourceUID,
  instanceSettings as expressionInstanceSettings,
} from 'app/features/expressions/ExpressionDatasource';
import { DataSourceVariableModel } from '../variables/types';
import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import appEvents from 'app/core/app_events';
import { getAngularInjector } from 'app/angular/lazyBootAngular';

export class DatasourceSrv implements DataSourceService {
  private datasources: Record<string, DataSourceApi> = {}; // UID
  private settingsMapByName: Record<string, DataSourceInstanceSettings> = {};
  private settingsMapByUid: Record<string, DataSourceInstanceSettings> = {};
  private settingsMapById: Record<string, DataSourceInstanceSettings> = {};
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

    // Preload expressions
    this.datasources[ExpressionDatasourceRef.type] = expressionDatasource as any;
    this.datasources[ExpressionDatasourceUID] = expressionDatasource as any;
    this.settingsMapByUid[ExpressionDatasourceRef.uid] = expressionInstanceSettings;
    this.settingsMapByUid[ExpressionDatasourceUID] = expressionInstanceSettings;
  }

  getDataSourceSettingsByUid(uid: string): DataSourceInstanceSettings | undefined {
    return this.settingsMapByUid[uid];
  }

  getInstanceSettings(ref: string | null | undefined | DataSourceRef): DataSourceInstanceSettings | undefined {
    const isstring = typeof ref === 'string';
    let nameOrUid = isstring ? (ref as string) : ((ref as any)?.uid as string | undefined);

    if (nameOrUid === 'default' || nameOrUid === null || nameOrUid === undefined) {
      if (!isstring && ref) {
        const type = (ref as any)?.type as string;
        if (type === ExpressionDatasourceRef.type) {
          return expressionDatasource.instanceSettings;
        } else if (type) {
          console.log('FIND Default instance for datasource type?', ref);
        }
      }
      return this.settingsMapByUid[this.defaultName] ?? this.settingsMapByName[this.defaultName];
    }

    // Complex logic to support template variable data source names
    // For this we just pick the current or first data source in the variable
    if (nameOrUid[0] === '$') {
      const interpolatedName = this.templateSrv.replace(nameOrUid, {}, variableInterpolation);

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
      };
    }

    return this.settingsMapByUid[nameOrUid] ?? this.settingsMapByName[nameOrUid];
  }

  get(ref?: string | DataSourceRef | null, scopedVars?: ScopedVars): Promise<DataSourceApi> {
    let nameOrUid = typeof ref === 'string' ? (ref as string) : ((ref as any)?.uid as string | undefined);
    if (!nameOrUid) {
      return this.get(this.defaultName);
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

  async loadDatasource(key: string): Promise<DataSourceApi<any, any>> {
    if (this.datasources[key]) {
      return Promise.resolve(this.datasources[key]);
    }

    // find the metadata
    const dsConfig = this.settingsMapByUid[key] ?? this.settingsMapByName[key] ?? this.settingsMapById[key];
    if (!dsConfig) {
      return Promise.reject({ message: `Datasource ${key} was not found` });
    }

    try {
      const dsPlugin = await importDataSourcePlugin(dsConfig.meta);
      // check if its in cache now
      if (this.datasources[key]) {
        return this.datasources[key];
      }

      // If there is only one constructor argument it is instanceSettings
      const useAngular = dsPlugin.DataSourceClass.length !== 1;
      let instance: DataSourceApi<any, any>;

      if (useAngular) {
        instance = (await getAngularInjector()).instantiate(dsPlugin.DataSourceClass, {
          instanceSettings: dsConfig,
        });
      } else {
        instance = new dsPlugin.DataSourceClass(dsConfig);
      }

      instance.components = dsPlugin.components;
      instance.meta = dsConfig.meta;

      // store in instance cache
      this.datasources[key] = instance;
      this.datasources[instance.uid] = instance;
      return instance;
    } catch (err) {
      appEvents.emit(AppEvents.alertError, [dsConfig.name + ' plugin failed', err.toString()]);
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
      if (filters.alerting && !x.meta.alerting) {
        return false;
      }
      if (filters.tracing && !x.meta.tracing) {
        return false;
      }
      if (filters.annotations && !x.meta.annotations) {
        return false;
      }
      if (filters.alerting && !x.meta.alerting) {
        return false;
      }
      if (filters.pluginId && x.meta.id !== filters.pluginId) {
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
      for (const variable of this.templateSrv.getVariables().filter((variable) => variable.type === 'datasource')) {
        const dsVar = variable as DataSourceVariableModel;
        const first = dsVar.current.value === 'default' ? this.defaultName : dsVar.current.value;
        const dsName = (first as unknown) as string;
        const dsSettings = this.settingsMapByName[dsName];

        if (dsSettings) {
          const key = `$\{${variable.name}\}`;
          base.push({
            ...dsSettings,
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
        base.push(this.getInstanceSettings('-- Mixed --')!);
      }

      if (filters.dashboard) {
        base.push(this.getInstanceSettings('-- Dashboard --')!);
      }

      if (!filters.tracing) {
        base.push(this.getInstanceSettings('-- Grafana --')!);
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
        value: x.isDefault ? null : x.name,
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
        value: x.isDefault ? null : x.name,
        meta: x.meta,
      };
    });
  }
}

export function variableInterpolation(value: any[]) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export const getDatasourceSrv = (): DatasourceSrv => {
  return getDataSourceService() as DatasourceSrv;
};

export default DatasourceSrv;
