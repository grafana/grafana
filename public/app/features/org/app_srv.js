define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('appSrv', function($rootScope, $timeout, $q, backendSrv) {
    var self = this;
    this.init = function() {
      console.log("appSrv init");
      this.apps = {};
    };

    this.get = function(type) {
      return $q(function(resolve) {
        if (type in self.apps) {
          return resolve(self.apps[type]);
        }
        backendSrv.get('api/org/apps').then(function(results) {
          _.forEach(results, function(p) {
            self.apps[p.type] = p;
          });
          return resolve(self.apps[type]);
        });
      });
    };

    this.getAll = function() {
      return $q(function(resolve) {
        if (!_.isEmpty(self.apps)) {
          return resolve(self.apps);
        }
        backendSrv.get('api/org/apps').then(function(results) {
          _.forEach(results, function(p) {
            self.apps[p.type] = p;
          });
          return resolve(self.apps);
        });
      });
    };

    this.update = function(app) {
      return $q(function(resolve, reject) {
        backendSrv.post('api/org/apps', app).then(function(resp) {
          self.apps[app.type] = app;
          resolve(resp);
        }, function(resp) {
          reject(resp);
        });
      });
    };

    this.init();
  });
});
