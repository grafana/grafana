// Libraries
import _ from 'lodash';
import coreModule from 'app/core/core_module';

// Utils
import config from 'app/core/config';
import { importPluginModule } from './plugin_loader';

// Types
import { DataSourceApi } from 'app/types/series';
import { DataSource } from 'app/types';

export class DatasourceSrv {
  datasources: { [name: string]: DataSource };

  /** @ngInject */
  constructor(private $q, private $injector, private $rootScope, private templateSrv) {
    this.init();
  }

  init() {
    this.datasources = {};
  }

  get(name?: string): Promise<DataSourceApi> {
    if (!name) {
      return this.get(config.defaultDatasource);
    }

    name = this.templateSrv.replace(name);

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
    const pluginDef = dsConfig.meta;

    importPluginModule(pluginDef.module)
      .then(plugin => {
        // check if its in cache now
        if (this.datasources[name]) {
          deferred.resolve(this.datasources[name]);
          return;
        }

        // plugin module needs to export a constructor function named Datasource
        if (!plugin.Datasource) {
          throw new Error('Plugin module is missing Datasource constructor');
        }

        const instance: DataSource = this.$injector.instantiate(plugin.Datasource, { instanceSettings: dsConfig });
        instance.meta = pluginDef;
        instance.name = name;
        instance.pluginExports = plugin;
        this.datasources[name] = instance;
        deferred.resolve(instance);
      })
      .catch(err => {
        this.$rootScope.appEvent('alert-error', [dsConfig.name + ' plugin failed', err.toString()]);
      });

    return deferred.promise;
  }

  getAll() {
    return config.datasources;
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

  getExploreSources() {
    const { datasources } = config;
    const es = Object.keys(datasources)
      .map(name => datasources[name])
      .filter(ds => ds.meta && ds.meta.explore);
    return _.sortBy(es, ['name']);
  }

  getMetricSources(options) {
    const metricSources = [];

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

let singleton: DatasourceSrv;

export function setDatasourceSrv(srv: DatasourceSrv) {
  singleton = srv;
}

export function getDatasourceSrv(): DatasourceSrv {
  return singleton;
}

coreModule.service('datasourceSrv', DatasourceSrv);
export default DatasourceSrv;
