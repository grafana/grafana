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

    $scope.removePlaylistConfirmed = function(playlist) {
      _.remove($scope.playlists, {id: playlist.id});

      backendSrv.delete('/api/playlists/' + playlist.id)
      .then(function() {
        $scope.appEvent('alert-success', ['Playlist deleted', '']);
      }, function() {
        $scope.appEvent('alert-error', ['Unable to delete playlist', '']);
        $scope.playlists.push(playlist);
      });
    };

    $scope.removePlaylist = function(playlist) {

      $scope.appEvent('confirm-modal', {
        title: 'Confirm delete playlist',
        text: 'Are you sure you want to delete playlist ' + playlist.name + '?',
        yesText: "Delete",
        icon: "fa-warning",
        onConfirm: function() {
          $scope.removePlaylistConfirmed(playlist);
        }
      });

    };

  });
});
