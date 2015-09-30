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
      var playlist = self.playlists[self.index % self.playlists.length];

      if(self.playlistType === "dashboards") {
        $location.url('dashboard/' + playlist.uri);
      } else if(self.playlistType === "variables") {
        var urlParameters = "";
        for(var i=0; i<playlist.list.length; i++) {
          urlParameters += 'var-' + playlist.list[i].tagName + "=" + playlist.list[i].tagValue + "&";
        }
        urlParameters = urlParameters.substring(0, urlParameters.length - 1);
        $location.url('dashboard/' + playlist.uri + '?' + urlParameters);
        $route.reload();
      }

      self.index++;
      self.cancelPromise = $timeout(self.next, self.interval);
    };

    this.prev = function() {
      self.index = Math.max(self.index - 2, 0);
      self.next();
    };

    this.start = function(playlistType, playlists, timespan) {
      self.stop();

      self.index = 0;
      self.interval = kbn.interval_to_ms(timespan);

      self.playlistType = playlistType;

      self.playlists = playlists;

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
