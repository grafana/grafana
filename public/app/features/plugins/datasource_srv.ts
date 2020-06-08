// Libraries
import sortBy from 'lodash/sortBy';
import coreModule from 'app/core/core_module';
// Services & Utils
import config from 'app/core/config';
import { importDataSourcePlugin } from './plugin_loader';
import { DataSourceSrv as DataSourceService, getDataSourceSrv as getDataSourceService } from '@grafana/runtime';
// Types
import { AppEvents, DataSourceApi, DataSourceInstanceSettings, DataSourceSelectItem, ScopedVars } from '@grafana/data';
import { auto } from 'angular';
import { TemplateSrv } from '../templating/template_srv';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
// Pretend Datasource
import { expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { DataSourceVariableModel } from '../variables/types';

export class DatasourceSrv implements DataSourceService {
  datasources: Record<string, DataSourceApi> = {};

  /** @ngInject */
  constructor(
    private $injector: auto.IInjectorService,
    private $rootScope: GrafanaRootScope,
    private templateSrv: TemplateSrv
  ) {
    this.init();
  }

  init() {
    this.datasources = {};
  }

  getDataSourceSettingsByUid(uid: string): DataSourceInstanceSettings | undefined {
    return Object.values(config.datasources).find(ds => ds.uid === uid);
  }

  get(name?: string, scopedVars?: ScopedVars): Promise<DataSourceApi> {
    if (!name) {
      return this.get(config.defaultDatasource);
    }

    // Interpolation here is to support template variable in data source selection
    name = this.templateSrv.replace(name, scopedVars, (value: any[]) => {
      if (Array.isArray(value)) {
        return value[0];
      }
      return value;
    });

    if (name === 'default') {
      return this.get(config.defaultDatasource);
    }

    if (this.datasources[name]) {
      return Promise.resolve(this.datasources[name]);
    }

    return this.loadDatasource(name);
  }

  async loadDatasource(name: string): Promise<DataSourceApi<any, any>> {
    // Expression Datasource (not a real datasource)
    if (name === expressionDatasource.name) {
      this.datasources[name] = expressionDatasource as any;
      return Promise.resolve(expressionDatasource);
    }

    const dsConfig = config.datasources[name];
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
    const { datasources } = config;
    return Object.keys(datasources).map(name => datasources[name]);
  }

  getExternal(): DataSourceInstanceSettings[] {
    const datasources = this.getAll().filter(ds => !ds.meta.builtIn);
    return sortBy(datasources, ['name']);
  }

  getAnnotationSources() {
    const sources: any[] = [];

    this.addDataSourceVariables(sources);

    Object.values(config.datasources).forEach(value => {
      if (value.meta?.annotations) {
        sources.push(value);
      }
    });

    return sources;
  }

  getMetricSources(options?: { skipVariables?: boolean }) {
    const metricSources: DataSourceSelectItem[] = [];

    Object.entries(config.datasources).forEach(([key, value]) => {
      if (value.meta?.metrics) {
        let metricSource = { value: key, name: key, meta: value.meta, sort: key };

        //Make sure grafana and mixed are sorted at the bottom
        if (value.meta.id === 'grafana') {
          metricSource.sort = String.fromCharCode(253);
        } else if (value.meta.id === 'dashboard') {
          metricSource.sort = String.fromCharCode(254);
        } else if (value.meta.id === 'mixed') {
          metricSource.sort = String.fromCharCode(255);
        }

        metricSources.push(metricSource);

        if (key === config.defaultDatasource) {
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
        const first = variable.current.value === 'default' ? config.defaultDatasource : variable.current.value;
        const index = (first as unknown) as string;
        const ds = config.datasources[index];

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
