define([
  'angular',
  'app/core/config',
  'lodash'
],
function (angular, config, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('PlaylistEditCtrl', function(
    playlist,
    dashboards,
    $scope,
    playlistSrv,
    backendSrv,
    $location
  ) {
    $scope.search = function() {
      var query = {starred: true, limit: 10};

      if ($scope.searchQuery) {
        query.query = $scope.searchQuery;
        query.starred = false;
      }

      $scope.loading = true;

      backendSrv.search(query)
        .then(function(results) {
          $scope.foundDashboards = results;
          $scope.filterFoundDashboards();
        })
        .finally(function() {
          $scope.loading = false;
        });
    };

    $scope.filterFoundDashboards = function() {
      $scope.filteredDashboards = _.reject($scope.foundDashboards, function(dashboard) {
        return _.findWhere(dashboards, function(listDashboard) {
          return listDashboard.id === dashboard.id;
        });
      });
    };

    $scope.addDashboard = function(dashboard) {
      dashboards.push(dashboard);
      $scope.filterFoundDashboards();
    };

    $scope.removeDashboard = function(dashboard) {
      _.remove(dashboards, function(listedDashboard) {
        return dashboard === listedDashboard;
      });
      $scope.filterFoundDashboards();
    };

    $scope.savePlaylist = function(playlist, dashboards) {
      var savePromise;

      playlist.data = dashboards.map(function(dashboard) {
        return dashboard.id;
      });

      // Hardcoding playlist type for this iteration
      playlist.type = "dashboards";

      savePromise = playlist.id
        ? backendSrv.put('/api/playlists/' + playlist.id, playlist)
        : backendSrv.post('/api/playlists', playlist);

      savePromise
        .then(function() {
          $scope.appEvent('alert-success', ['Playlist saved', '']);
          $location.path('/playlists');
        }, function() {
          $scope.appEvent('alert-success', ['Unable to save playlist', '']);
        });
    };

    $scope.isPlaylistEmpty = function() {
      return !dashboards.length;
    };

    $scope.isSearchResultsEmpty = function() {
      return !$scope.foundDashboards.length;
    };

    $scope.isSearchQueryEmpty = function() {
      return $scope.searchQuery === '';
    };

    $scope.backToList = function() {
      $location.path('/playlists');
    };

    $scope.isLoading = function() {
      return $scope.loading;
    };

    $scope.playlist = playlist;
    $scope.dashboards = dashboards;
    $scope.timespan = config.playlist_timespan;
    $scope.filteredDashboards = [];
    $scope.foundDashboards = [];
    $scope.searchQuery = '';
    $scope.loading = false;
    $scope.search();
  });
});
