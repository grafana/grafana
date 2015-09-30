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
      var playlistVar = self.playlistVars[self.index % self.playlistVars.length];

      if(self.playlistType === "dashboards") {
        $location.url('dashboard/' + playlistVar.uri);
      } else if(self.playlistType === "variables") {
        var urlParameters = "";
        for(var i=0; i<playlistVar.varCombinations.length; i++) {
          urlParameters += 'var-' + playlistVar.varCombinations[i].tagName + "=" + playlistVar.varCombinations[i].tagValue + "&";
        }
        urlParameters = urlParameters.substring(0, urlParameters.length - 1);
        console.log(urlParameters);
        $location.url('dashboard/' + playlistVar.dashboardSlug + '?' + urlParameters);
        $route.reload();
      }

      self.index++;
      self.cancelPromise = $timeout(self.next, self.interval);
    };

    this.prev = function() {
      self.index = Math.max(self.index - 2, 0);
      self.next();
    };

    this.start = function(playlistType, playlistVars, timespan) {
      self.stop();

      self.index = 0;
      self.interval = kbn.interval_to_ms(timespan);

      self.playlistType = playlistType;

      self.playlistVars = playlistVars;

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
