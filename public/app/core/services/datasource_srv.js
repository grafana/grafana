define([
  'angular',
  'lodash',
  '../core_module',
  'app/core/config',
  'app/core/utils/datemath',
],
function (angular, _, coreModule, config, dateMath) {
  'use strict';

  coreModule.service('datasourceSrv', function($q, $injector, $rootScope) {
    var self = this;

    this.init = function() {
      this.datasources = {};
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

    this.get = function(name) {
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

    this.getMetricSources = function() {
      return this.metricSources;
    };

    this.getStatus = function(query, startTime, endTime) {
      var end = endTime ? dateMath.parse(endTime, false).valueOf() : null;
      return this.get('opentsdb').then(function(datasource) {
        return datasource.performTimeSeriesQuery(query, dateMath.parse(startTime, false).valueOf(), end).then(function(response) {
          if (_.isEmpty(response.data)) {
            throw Error;
          }
          return response.data;
        });
      });
    }

    this.getHostStatus = function(query, startTime, endTime) {
      return this.getStatus(query, startTime, endTime).then(function (response) {
        var service = _.getMetricName(query[0].metric);
        var status = null;
        var host = null;
        _.each(response, function (metricData) {
          host = metricData.tags.host;
          if (_.isObject(metricData)) {
            status = metricData.dps[Object.keys(metricData.dps)[0]];
            if(typeof(status) != "number") {
              throw Error;
            }
          }
        });
        return {name: service, status: status, host: host};
      });
    }

    this.init();
  });
});
