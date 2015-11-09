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
      this.dynamicDatasources = {};
      this.metricSources = [];
      this.annotationSources = [];

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

    this.addDynamicDatasource = function(name, targetDatasourceName) {
      var varName = '$' + name;
      this.dynamicDatasources[varName] = targetDatasourceName;

      if (_.findIndex(this.metricSources, { name: name }) === -1) {
        this.metricSources.push({name: varName, value: varName, meta: {dynamic: true}});
      }
    };

    this.removeDynamicDatasource = function(name) {
      var varName = '$' + name;
      if (varName in this.dynamicDatasources) {
        delete this.dynamicDatasources[varName];
      }

      var idx = _.findIndex(this.metricSources, {name: name});
      if (idx !== -1) {
        this.metricSources.splice(idx, 1);
      }
    };

    this.updateDynamicDatasource = function(name, targetDatasource) {
      var varName = '$' + name;

      if (varName in this.dynamicDatasources) {
        this.dynamicDatasources[varName] = targetDatasource;
      }

      $rootScope.$broadcast('dynamic-datasource-updated', {
        name: varName
      });
    };

    this.resetDynamicDatasources = function() {
      this.dynamicDatasources = {};

      this.metricSources = this.metricSources.filter(function(source) {
        return source.name[0] !== '$';
      });
    };

    this.get = function(name) {
      if (!name) {
        return this.get(config.defaultDatasource);
      }

      if (name[0] === '$') {
        return this._aquireDatasource(this.dynamicDatasources[name])
          .then(function(ds) {
            return _.create(ds, {name: name, value: name});
          });
      }
      else {
        return this._aquireDatasource(name);
      }
    };

    this._aquireDatasource = function(name) {
      if (this.datasources[name]) {
        return $q.when(this.datasources[name]);
      }
      else {
        return this.loadDatasource(name);
      }
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

        if (name[0] !== '$') {
          self.datasources[name] = instance;
        }

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

    this.getMetricSources = function() {
      return this.metricSources;
    };

    this.init();
  });
});
