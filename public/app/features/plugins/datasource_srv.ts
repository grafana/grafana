// Libraries
import _ from 'lodash';
import coreModule from 'app/core/core_module';

// Services & Utils
import config from 'app/core/config';
import { importDataSourcePlugin } from './plugin_loader';
import { DataSourceSrv as DataSourceService, getDataSourceSrv as getDataSourceService } from '@grafana/runtime';

// Types
import { DataSourceApi, DataSourceSelectItem, ScopedVars } from '@grafana/ui/src/types';

export class DatasourceSrv implements DataSourceService {
  datasources: { [name: string]: DataSourceApi };

  /** @ngInject */
  constructor(private $q, private $injector, private $rootScope, private templateSrv) {
    this.init();
  }

  init() {
    this.datasources = {};
  }

  get(name?: string, scopedVars?: ScopedVars): Promise<DataSourceApi> {
    if (!name) {
      return this.get(config.defaultDatasource);
    }

    // Interpolation here is to support template variable in data source selection
    name = this.templateSrv.replace(name, scopedVars, (value, variable) => {
      if (Array.isArray(value)) {
        return value[0];
      }
      return value;
    });

    if (name === 'default') {
      return this.get(config.defaultDatasource);
    }

    if (this.datasources[name]) {
      return this.$q.when(this.datasources[name]);
    }

    return this.loadDatasource(name);
  }

  loadDatasource(name: string): Promise<DataSourceApi> {
    const dsConfig = config.datasources[name];
    if (!dsConfig) {
      return this.$q.reject({ message: 'Datasource named ' + name + ' was not found' });
    }

    const deferred = this.$q.defer();

    importDataSourcePlugin(dsConfig.meta)
      .then(dsPlugin => {
        // check if its in cache now
        if (this.datasources[name]) {
          deferred.resolve(this.datasources[name]);
          return;
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
        deferred.resolve(instance);
      })
      .catch(err => {
        this.$rootScope.appEvent('alert-error', [dsConfig.name + ' plugin failed', err.toString()]);
      });

    return deferred.promise;
  }

  getAll() {
    const { datasources } = config;
    return Object.keys(datasources).map(name => datasources[name]);
  }

  getExternal() {
    const datasources = this.getAll().filter(ds => !ds.meta.builtIn);
    return _.sortBy(datasources, ['name']);
  }

  getAnnotationSources() {
    const sources = [];

    this.addDataSourceVariables(sources);

    _.each(config.datasources, value => {
      if (value.meta && value.meta.annotations) {
        sources.push(value);
      }
    });

    return sources;
  }

  getMetricSources(options?) {
    const metricSources: DataSourceSelectItem[] = [];

    _.each(config.datasources, (value, key) => {
      if (value.meta && value.meta.metrics) {
        let metricSource = { value: key, name: key, meta: value.meta, sort: key };

        //Make sure grafana and mixed are sorted at the bottom
        if (value.meta.id === 'grafana') {
          metricSource.sort = String.fromCharCode(253);
        } else if (value.meta.id === 'mixed') {
          metricSource.sort = String.fromCharCode(254);
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

  addDataSourceVariables(list) {
    // look for data source variables
    for (let i = 0; i < this.templateSrv.variables.length; i++) {
      const variable = this.templateSrv.variables[i];
      if (variable.type !== 'datasource') {
        continue;
      }

      let first = variable.current.value;
      if (first === 'default') {
        first = config.defaultDatasource;
      }

      const ds = config.datasources[first];

      if (ds) {
        const key = `$${variable.name}`;
        list.push({
          name: key,
          value: key,
          meta: ds.meta,
          sort: key,
        });
      }
    }
  }
}

export function getDatasourceSrv(): DatasourceSrv {
  return getDataSourceService() as DatasourceSrv;
}

coreModule.service('datasourceSrv', DatasourceSrv);
export default DatasourceSrv;
