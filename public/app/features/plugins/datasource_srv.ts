// Libraries
import coreModule from 'app/core/core_module';
// Services & Utils
import { importDataSourcePlugin } from './plugin_loader';
import {
  GetDataSourceListFilters,
  DataSourceSrv as DataSourceService,
  getDataSourceSrv as getDataSourceService,
  TemplateSrv,
} from '@grafana/runtime';
// Types
import { AppEvents, DataSourceApi, DataSourceInstanceSettings, DataSourceSelectItem, ScopedVars } from '@grafana/data';
import { auto } from 'angular';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
// Pretend Datasource
import { expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { DataSourceVariableModel } from '../variables/types';
import { cloneDeep } from 'lodash';

export class DatasourceSrv implements DataSourceService {
  private datasources: Record<string, DataSourceApi> = {};
  private settingsMapByName: Record<string, DataSourceInstanceSettings> = {};
  private settingsMapByUid: Record<string, DataSourceInstanceSettings> = {};
  private defaultName = '';

  /** @ngInject */
  constructor(
    private $injector: auto.IInjectorService,
    private $rootScope: GrafanaRootScope,
    private templateSrv: TemplateSrv
  ) {}

  init(settingsMapByName: Record<string, DataSourceInstanceSettings>, defaultName: string) {
    this.datasources = {};
    this.settingsMapByUid = {};
    this.settingsMapByName = settingsMapByName;
    this.defaultName = defaultName;

    for (const dsSettings of Object.values(settingsMapByName)) {
      this.settingsMapByUid[dsSettings.uid] = dsSettings;
    }
  }

  getDataSourceSettingsByUid(uid: string): DataSourceInstanceSettings | undefined {
    return this.settingsMapByUid[uid];
  }

  getInstanceSettings(nameOrUid: string | null | undefined): DataSourceInstanceSettings | undefined {
    if (nameOrUid === 'default' || nameOrUid === null || nameOrUid === undefined) {
      return this.settingsMapByName[this.defaultName];
    }

    // Complex logic to support template variable data source names
    // For this we just pick the current or first data source in the variable
    if (nameOrUid[0] === '$') {
      const interpolatedName = this.templateSrv.replace(nameOrUid, {}, variableInterpolation);
      const dsSettings = this.settingsMapByUid[interpolatedName] ?? this.settingsMapByName[interpolatedName];
      if (!dsSettings) {
        return undefined;
      }
      // The return name or uid needs preservet string containing the variable
      const clone = cloneDeep(dsSettings);
      clone.name = nameOrUid;
      return clone;
    }

    return this.settingsMapByUid[nameOrUid] ?? this.settingsMapByName[nameOrUid];
  }

  get(nameOrUid?: string | null, scopedVars?: ScopedVars): Promise<DataSourceApi> {
    if (!nameOrUid) {
      return this.get(this.defaultName);
    }

    // Check if nameOrUid matches a uid and then get the name
    const byUid = this.settingsMapByUid[nameOrUid];
    if (byUid) {
      nameOrUid = byUid.name;
    }

    // This check is duplicated below, this is here mainly as performance optimization to skip interpolation
    if (this.datasources[nameOrUid]) {
      return Promise.resolve(this.datasources[nameOrUid]);
    }

    // Interpolation here is to support template variable in data source selection
    nameOrUid = this.templateSrv.replace(nameOrUid, scopedVars, variableInterpolation);

    if (nameOrUid === 'default') {
      return this.get(this.defaultName);
    }

    if (this.datasources[nameOrUid]) {
      return Promise.resolve(this.datasources[nameOrUid]);
    }

    return this.loadDatasource(nameOrUid);
  }

  async loadDatasource(name: string): Promise<DataSourceApi<any, any>> {
    // Expression Datasource (not a real datasource)
    if (name === expressionDatasource.name) {
      this.datasources[name] = expressionDatasource as any;
      return Promise.resolve(expressionDatasource);
    }

    const dsConfig = this.settingsMapByName[name];
    if (!dsConfig) {
      return Promise.reject({ message: `Datasource named ${name} was not found` });
    }

    try {
      const dsPlugin = await importDataSourcePlugin(dsConfig.meta);
      // check if its in cache now
      if (this.datasources[name]) {
        return this.datasources[name];
      }

      // If there is only one constructor argument it is instanceSettings
      const useAngular = dsPlugin.DataSourceClass.length !== 1;
      const instance: DataSourceApi = useAngular
        ? this.$injector.instantiate(dsPlugin.DataSourceClass, {
            instanceSettings: dsConfig,
          })
        : new dsPlugin.DataSourceClass(dsConfig);

      instance.components = dsPlugin.components;
      instance.meta = dsConfig.meta;

      // store in instance cache
      this.datasources[name] = instance;
      return instance;
    } catch (err) {
      this.$rootScope.appEvent(AppEvents.alertError, [dsConfig.name + ' plugin failed', err.toString()]);
      return Promise.reject({ message: `Datasource named ${name} was not found` });
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
      if (filters.annotations && !x.meta.annotations) {
        return false;
      }
      if (filters.pluginId && x.meta.id !== filters.pluginId) {
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

    if (!filters.pluginId) {
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

coreModule.service('datasourceSrv', DatasourceSrv);
export default DatasourceSrv;
