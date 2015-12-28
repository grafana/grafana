define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('PlaylistsCtrl', function(
    playlists,
    $scope,
    $location,
    backendSrv
  ) {

    $scope.playlists = playlists;

    $scope.playlistUrl = function(playlist) {
      return '/playlists/play/' + playlist.id;
    };

    $scope.removePlaylist = function(playlist) {
      var modalScope = $scope.$new(true);

      modalScope.playlist = playlist;
      modalScope.removePlaylist = function() {
        modalScope.dismiss();
        _.remove(playlists, {id: playlist.id});

        backendSrv.delete('/api/playlists/' + playlist.id)
          .then(function() {
            $scope.appEvent('alert-success', ['Playlist deleted', '']);
          }, function() {
            $scope.appEvent('alert-error', ['Unable to delete playlist', '']);
            playlists.push(playlist);
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
