import _ from 'lodash';
import coreModule from 'app/core/core_module';
import config from 'app/core/config';
import { importPluginModule } from './plugin_loader';

export class DatasourceSrv {
  datasources: any;

  /** @ngInject */
  constructor(private $q, private $injector, private $rootScope, private templateSrv) {
    this.init();
  }

  init() {
    this.datasources = {};
  }

  get(name?) {
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

  loadDatasource(name) {
    var dsConfig = config.datasources[name];
    if (!dsConfig) {
      return this.$q.reject({ message: 'Datasource named ' + name + ' was not found' });
    }

    var deferred = this.$q.defer();
    var pluginDef = dsConfig.meta;

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

        var instance = this.$injector.instantiate(plugin.Datasource, { instanceSettings: dsConfig });
        instance.meta = pluginDef;
        instance.name = name;
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
    var sources = [];

    this.addDataSourceVariables(sources);

    _.each(config.datasources, function(value) {
      if (value.meta && value.meta.annotations) {
        sources.push(value);
      }
    });

    return sources;
  }

  getMetricSources(options) {
    var metricSources = [];

    _.each(config.datasources, function(value, key) {
      if (value.meta && value.meta.metrics) {
        metricSources.push({ value: key, name: key, meta: value.meta });

        if (key === config.defaultDatasource) {
          metricSources.push({ value: null, name: 'default', meta: value.meta });
        }
      }
    });

    if (!options || !options.skipVariables) {
      this.addDataSourceVariables(metricSources);
    }

    metricSources.sort(function(a, b) {
      // these two should always be at the bottom
      if (a.meta.id === 'mixed' || a.meta.id === 'grafana') {
        return 1;
      }
      if (b.meta.id === 'mixed' || b.meta.id === 'grafana') {
        return -1;
      }
      if (a.name.toLowerCase() > b.name.toLowerCase()) {
        return 1;
      }
      if (a.name.toLowerCase() < b.name.toLowerCase()) {
        return -1;
      }
      return 0;
    });

    return metricSources;
  }

  addDataSourceVariables(list) {
    // look for data source variables
    for (var i = 0; i < this.templateSrv.variables.length; i++) {
      var variable = this.templateSrv.variables[i];
      if (variable.type !== 'datasource') {
        continue;
      }

      var first = variable.current.value;
      if (first === 'default') {
        first = config.defaultDatasource;
      }

      var ds = config.datasources[first];

      if (ds) {
        list.push({
          name: '$' + variable.name,
          value: '$' + variable.name,
          meta: ds.meta,
        });
      }
    }
  }
}

coreModule.service('datasourceSrv', DatasourceSrv);
