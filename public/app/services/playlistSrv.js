define([
  'angular',
  'underscore',
  'kbn'
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('kibana.services');

  module.service('playlistSrv', function(dashboard, $location, $rootScope) {
    var timerInstance;
    var favorites = { dashboards: [] };

    this.init = function() {
      var existingJson = window.localStorage["grafana-favorites"];
      if (existingJson) {
        favorites = angular.fromJson(existingJson);
      }
    };

    this._save = function() {
      window.localStorage["grafana-favorites"] = angular.toJson(favorites);
    };

    this._find = function(title) {
      return _.findWhere(favorites.dashboards, { title: title });
    };

    this._remove = function(existing) {
      if (existing) {
        favorites.dashboards = _.without(favorites.dashboards, existing);
      }
    };

    this.isCurrentFavorite = function() {
      return this._find(dashboard.current.title) ? true : false;
    };

    this.markAsFavorite = function() {
      var existing = this._find(dashboard.current.title);
      this._remove(existing);

      favorites.dashboards.push({
        url: $location.path(),
        title: dashboard.current.title
      });

      this._save();
    };

    this.removeAsFavorite = function(toRemove) {
      var existing = this._find(toRemove.title);
      this._remove(existing);
      this._save();
    };

    this.getFavorites = function() {
      return favorites;
    };

    this.start = function(dashboards, timespan) {
      var interval = kbn.interval_to_ms(timespan);
      var index = 0;

      $rootScope.playlist_active = true;

      timerInstance = setInterval(function() {
        $rootScope.$apply(function() {
          angular.element(window).unbind('resize');
          $location.path(dashboards[index % dashboards.length].url);
          index++;
        });
      }, interval);
    };

    this.stop = function() {
      clearInterval(timerInstance);
      $rootScope.playlist_active = false;
    };

    this.init();

  });

});
