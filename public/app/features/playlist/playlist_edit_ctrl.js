define([
  'angular',
  'app/core/config',
  'lodash'
],
function (angular, config, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('PlaylistEditCtrl', function($scope, playlistSrv, backendSrv, $location, $route) {
    $scope.filteredPlaylistItems = [];
    $scope.foundPlaylistItems = [];
    $scope.searchQuery = '';
    $scope.loading = false;
    $scope.playlist = {
      interval: '10m',
    };
    $scope.playlistItems = [];

    $scope.init = function() {
      if ($route.current.params.id) {
        var playlistId = $route.current.params.id;

        backendSrv.get('/api/playlists/' + playlistId)
          .then(function(result) {
            $scope.playlist = result;
          });

        backendSrv.get('/api/playlists/' + playlistId + '/items')
          .then(function(result) {
            $scope.playlistItems = result;
          });
      }

      $scope.search();
    };

    $scope.search = function() {
      var query = {limit: 10};

      if ($scope.searchQuery) {
        query.query = $scope.searchQuery;
      }

      $scope.loading = true;

      backendSrv.search(query)
        .then(function(results) {
          $scope.foundPlaylistItems = results;
          $scope.filterFoundPlaylistItems();
        })
        .finally(function() {
          $scope.loading = false;
        });
    };

    $scope.filterFoundPlaylistItems = function() {
      $scope.filteredPlaylistItems = _.reject($scope.foundPlaylistItems, function(playlistItem) {
        return _.findWhere($scope.playlistItems, function(listPlaylistItem) {
          return parseInt(listPlaylistItem.value) === playlistItem.id;
        });
      });
    };

    $scope.addPlaylistItem = function(playlistItem) {
      playlistItem.value = playlistItem.id.toString();
      playlistItem.type = 'dashboard_by_id';
      playlistItem.order = $scope.playlistItems.length + 1;

      $scope.playlistItems.push(playlistItem);
      $scope.filterFoundPlaylistItems();
    };

    $scope.removePlaylistItem = function(playlistItem) {
      _.remove($scope.playlistItems, function(listedPlaylistItem) {
        return playlistItem === listedPlaylistItem;
      });
      $scope.filterFoundPlaylistItems();
    };

    $scope.savePlaylist = function(playlist, playlistItems) {
      var savePromise;

      playlist.items = playlistItems;

      savePromise = playlist.id
        ? backendSrv.put('/api/playlists/' + playlist.id, playlist)
        : backendSrv.post('/api/playlists', playlist);

      savePromise
        .then(function() {
          $scope.appEvent('alert-success', ['Playlist saved', '']);
          $location.path('/playlists');
        }, function() {
          $scope.appEvent('alert-error', ['Unable to save playlist', '']);
        });
    };

    $scope.isNew = function() {
      return !$scope.playlist.id;
    };

    $scope.isPlaylistEmpty = function() {
      return !$scope.playlistItems.length;
    };

    $scope.isSearchResultsEmpty = function() {
      return !$scope.foundPlaylistItems.length;
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

    $scope.movePlaylistItem = function(playlistItem, offset) {
      var currentPosition = $scope.playlistItems.indexOf(playlistItem);
      var newPosition = currentPosition + offset;

      if (newPosition >= 0 && newPosition < $scope.playlistItems.length) {
        $scope.playlistItems.splice(currentPosition, 1);
        $scope.playlistItems.splice(newPosition, 0, playlistItem);
      }
    };

    $scope.movePlaylistItemUp = function(playlistItem) {
      $scope.moveDashboard(playlistItem, -1);
    };

    $scope.movePlaylistItemDown = function(playlistItem) {
      $scope.moveDashboard(playlistItem, 1);
    };

    $scope.init();
  });
});
