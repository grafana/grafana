// Libraries
import sortBy from 'lodash/sortBy';
import coreModule from 'app/core/core_module';
// Services & Utils
import { importDataSourcePlugin } from './plugin_loader';
import {
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
    nameOrUid = this.templateSrv.replace(nameOrUid, scopedVars, (value: any[]) => {
      if (Array.isArray(value)) {
        return value[0];
      }
      return value;
    });

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

  getExternal(): DataSourceInstanceSettings[] {
    const datasources = this.getAll().filter(ds => !ds.meta.builtIn);
    return sortBy(datasources, ['name']);
  }

  getAnnotationSources() {
    const sources: any[] = [];

    this.addDataSourceVariables(sources);

    Object.values(this.settingsMapByName).forEach(value => {
      if (value.meta?.annotations) {
        sources.push(value);
      }
    });

    return sources;
  }

  getMetricSources(options?: { skipVariables?: boolean }) {
    const metricSources: DataSourceSelectItem[] = [];

    Object.entries(this.settingsMapByName).forEach(([key, value]) => {
      if (value.meta?.metrics) {
        let metricSource: DataSourceSelectItem = { value: key, name: key, meta: value.meta, sort: key };

        //Make sure grafana and mixed are sorted at the bottom
        if (value.meta.id === 'grafana') {
          metricSource.sort = String.fromCharCode(253);
        } else if (value.meta.id === 'dashboard') {
          metricSource.sort = String.fromCharCode(254);
        } else if (value.meta.id === 'mixed') {
          metricSource.sort = String.fromCharCode(255);
        }

        metricSources.push(metricSource);

        if (key === this.defaultName) {
          metricSource = { value: null, name: 'default', meta: value.meta, sort: key };
          metricSources.push(metricSource);
        }
      }
    });

    if (!options || !options.skipVariables) {
      this.addDataSourceVariables(metricSources);
    }

    metricSources.sort((a, b) => {
      if (a.sort.toLowerCase() > b.sort.toLowerCase()) {
        return 1;
      }
      if (a.sort.toLowerCase() < b.sort.toLowerCase()) {
        return -1;
      }
      return 0;
    });

    return metricSources;
  }

  addDataSourceVariables(list: any[]) {
    // look for data source variables
    this.templateSrv
      .getVariables()
      .filter(variable => variable.type === 'datasource')
      .forEach((variable: DataSourceVariableModel) => {
        const first = variable.current.value === 'default' ? this.defaultName : variable.current.value;
        const index = (first as unknown) as string;
        const ds = this.settingsMapByName[index];

        if (ds) {
          const key = `$${variable.name}`;
          list.push({
            name: key,
            value: key,
            meta: ds.meta,
            sort: key,
          });
        }
      });
  }
}

export const getDatasourceSrv = (): DatasourceSrv => {
  return getDataSourceService() as DatasourceSrv;
};

coreModule.service('datasourceSrv', DatasourceSrv);
export default DatasourceSrv;
