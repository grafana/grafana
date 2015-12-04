define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('pluginSrv', function($rootScope, $timeout, $q, backendSrv) {
    var self = this;
    this.init = function() {
      console.log("pluginSrv init");
      this.plugins = {};
    };

    this.get = function(type) {
      return $q(function(resolve) {
        if (type in self.plugins) {
          return resolve(self.plugins[type]);
        }
        backendSrv.get('/api/plugins').then(function(results) {
          _.forEach(results, function(p) {
            self.plugins[p.type] = p;
          });
          return resolve(self.plugins[type]);
        });
      });
    };

    this.getAll = function() {
      return $q(function(resolve) {
        if (!_.isEmpty(self.plugins)) {
          return resolve(self.plugins);
        }
        backendSrv.get('api/plugins').then(function(results) {
          _.forEach(results, function(p) {
            self.plugins[p.type] = p;
          });
          return resolve(self.plugins);
        });
      });
    };

    this.update = function(plugin) {
      return $q(function(resolve, reject) {
        backendSrv.post('/api/plugins', plugin).then(function(resp) {
          self.plugins[plugin.type] = plugin;
          resolve(resp);
        }, function(resp) {
          reject(resp);
        });
      });
    };

    this.init();
  });
});
