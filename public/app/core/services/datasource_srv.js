define([
  'angular',
  'lodash',
  '../core_module',
  'app/core/config',
],
function (angular, _, coreModule, config) {
  'use strict';

  coreModule.service('datasourceSrv', function($q, $injector, $rootScope) {
    var self = this;

    this.init = function() {
      this.datasources = {};
      this.metricSources = [];
      this.annotationSources = [];
      this.idMapSources = [];

      _.each(config.datasources, function(value, key) {
        if (value.meta && value.meta.metrics) {
          self.metricSources.push({
            value: key === config.defaultDatasource ? null : key,
            name: key,
            meta: value.meta,
          });
        }
        if (value.meta && value.meta.annotations) {
          self.annotationSources.push(value);
        }
        if (value.meta && value.meta.mapIds) {
          self.idMapSources.push(value);
        }
      });

      this.metricSources.sort(function(a, b) {
        if (a.meta.builtIn || a.name > b.name) {
          return 1;
        }
        if (a.name < b.name) {
          return -1;
        }
        return 0;
      });
    };

    this.get = function(name) {
      if (name === "Dummy") {
        return $q.when({name:"Dummy", meta:{name:"CustomType"}});
      }
      if (!name) {
        return this.get(config.defaultDatasource);
      }

      if (this.datasources[name]) {
        return $q.when(this.datasources[name]);
      }

      return this.loadDatasource(name);
    };

    this.loadDatasource = function(name) {
      var dsConfig = config.datasources[name];
      if (!dsConfig) {
        return $q.reject({message: "Datasource named " + name + " was not found"});
      }

      var deferred = $q.defer();

      var pluginDef = dsConfig.meta;

      $rootScope.require([pluginDef.module], function() {
        var AngularService = $injector.get(pluginDef.serviceName);
        var instance = new AngularService(dsConfig, pluginDef);
        instance.meta = pluginDef;
        instance.name = name;
        self.datasources[name] = instance;
        deferred.resolve(instance);
      });

      return deferred.promise;
    };

    this.getAll = function() {
      return config.datasources;
    };

    this.getAnnotationSources = function() {
      return this.annotationSources;
    };

    this.getIdMapSources = function() {
      return _.union(this.idMapSources, [{name:"Dummy", meta:{name:"CustomType"}}]);
    };

    this.getMetricSources = function() {
      return this.metricSources;
    };

    this.init();
  });
});
