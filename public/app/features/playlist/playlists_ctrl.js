define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('PlaylistsCtrl', function($scope, $location, backendSrv) {
    backendSrv.get('/api/playlists')
      .then(function(result) {
        $scope.playlists = result;
      });

    $scope.removePlaylist = function(playlist) {
      var modalScope = $scope.$new(true);

      modalScope.playlist = playlist;
      modalScope.removePlaylist = function() {
        modalScope.dismiss();
        _.remove($scope.playlists, {id: playlist.id});

        backendSrv.delete('/api/playlists/' + playlist.id)
          .then(function() {
            $scope.appEvent('alert-success', ['Playlist deleted', '']);
          }, function() {
            $scope.appEvent('alert-error', ['Unable to delete playlist', '']);
            $scope.playlists.push(playlist);
          });
      };

      $scope.appEvent('show-modal', {
        src: './app/features/playlist/partials/playlist-remove.html',
        scope: modalScope
      });
    };

    $scope.createPlaylist = function() {
      $location.path('/playlists/create');
    };
  });
});
