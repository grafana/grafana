define([
  'angular',
  'app/core/config',
  'lodash'
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/playlists', {
        templateUrl: 'app/features/playlist/partials/playlists.html',
        controller : 'PlaylistsCtrl'
      })
      .when('/playlists/create', {
        templateUrl: 'app/features/playlist/partials/playlist.html',
        controller : 'PlaylistEditCtrl'
      })
      .when('/playlists/edit/:id', {
        templateUrl: 'app/features/playlist/partials/playlist.html',
        controller : 'PlaylistEditCtrl'
      })
      .when('/playlists/play/:id', {
        resolve: {
          init: function(playlistSrv, $route) {
            var playlistId = $route.current.params.id;
            playlistSrv.start(playlistId);
          }
        }
      });
  });
});
