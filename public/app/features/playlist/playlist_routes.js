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
        templateUrl: 'public/app/features/playlist/partials/playlists.html',
        controllerAs: 'ctrl',
        controller : 'PlaylistsCtrl'
      })
      .when('/playlists/create', {
        templateUrl: 'public/app/features/playlist/partials/playlist.html',
        controllerAs: 'ctrl',
        controller : 'PlaylistEditCtrl'
      })
      .when('/playlists/edit/:id', {
        templateUrl: 'public/app/features/playlist/partials/playlist.html',
        controllerAs: 'ctrl',
        controller : 'PlaylistEditCtrl'
      })
      .when('/playlists/play/:id', {
        templateUrl: 'public/app/features/playlist/partials/playlists.html',
        controllerAs: 'ctrl',
        controller : 'PlaylistsCtrl',
        resolve: {
          init: function(playlistSrv, $route) {
            var playlistId = $route.current.params.id;
            playlistSrv.start(playlistId);
          }
        }
      });
  });
});
