define([
  'angular',
  'app/core/config',
  'lodash'
],
function (angular, config, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('PlaylistEditCtrl', function($scope, playlistSrv, backendSrv, $location, $route) {
    $scope.timespan = config.playlist_timespan;
    $scope.filteredDashboards = [];
    $scope.foundDashboards = [];
    $scope.searchQuery = '';
    $scope.loading = false;
    $scope.playlist = {};
    $scope.dashboards = [];

    if ($route.current.params.id) {
      var playlistId = $route.current.params.id;

      backendSrv.get('/api/playlists/' + playlistId)
        .then(function(result) {
          $scope.playlist = result;
        });

      backendSrv.get('/api/playlists/' + playlistId + '/dashboards')
        .then(function(result) {
          $scope.dashboards = result;
        });
    }

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
        return _.findWhere($scope.dashboards, function(listDashboard) {
          return listDashboard.id === dashboard.id;
        });
      });
    };

    $scope.addDashboard = function(dashboard) {
      $scope.dashboards.push(dashboard);
      $scope.filterFoundDashboards();
    };

    $scope.removeDashboard = function(dashboard) {
      _.remove($scope.dashboards, function(listedDashboard) {
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

    $scope.isNew = function() {
      return !$scope.playlist.id;
    };

    $scope.startPlaylist = function(playlist, dashboards) {
      playlistSrv.start(dashboards, playlist.timespan);
    };

    $scope.isPlaylistEmpty = function() {
      return !$scope.dashboards.length;
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

    $scope.moveDashboard = function(dashboard, offset) {
      var currentPosition = $scope.dashboards.indexOf(dashboard);
      var newPosition = currentPosition + offset;

      if (newPosition >= 0 && newPosition < $scope.dashboards.length) {
        $scope.dashboards.splice(currentPosition, 1);
        $scope.dashboards.splice(newPosition, 0, dashboard);
      }
    };

    $scope.moveDashboardUp = function(dashboard) {
      $scope.moveDashboard(dashboard, -1);
    };

    $scope.moveDashboardDown = function(dashboard) {
      $scope.moveDashboard(dashboard, 1);
    };

    $scope.search();
  });
});
