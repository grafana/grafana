define([
  'angular',
  'lodash',
  'kbn',
  'store'
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('grafana.services');

  module.service('playlistSrv', function($route, $location, $rootScope, $timeout) {
    var self = this;

    this.next = function() {
      $timeout.cancel(self.cancelPromise);

      angular.element(window).unbind('resize');
      var dash = self.dashboards[self.index % self.dashboards.length];

      if(self.playlistType === "dashboard") {
        $location.url('dashboard/' + dash.uri);
      }
      if(self.playlistType === "templateVariable") {
        $location.url('dashboard/db/' + dash.dashboardSlug + '?var-' + dash.tagName + '=' + dash.tagValue);
        $route.reload();
      }

      self.index++;
      self.cancelPromise = $timeout(self.next, self.interval);
    };

    this.prev = function() {
      self.index = Math.max(self.index - 2, 0);
      self.next();
    };

    this.start = function(playlistType, dashboards, timespan) {
      self.stop();

      self.index = 0;
      self.interval = kbn.interval_to_ms(timespan);

      self.playlistType = playlistType;

      self.dashboards = dashboards;

      $rootScope.playlistSrv = this;

      self.cancelPromise = $timeout(self.next, self.interval);
      self.next();
    };

    this.stop = function() {
      self.index = 0;

      if (self.cancelPromise) {
        $timeout.cancel(self.cancelPromise);
      }

      $rootScope.playlistSrv = null;
    };

  });

});
