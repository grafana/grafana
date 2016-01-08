define([
  'angular',
  'app/core/config',
  'lodash'
],
function (angular, config, _) {
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
        templateUrl: 'app/partials/dashboard.html',
        controller : 'LoadDashboardCtrl',
        resolve: {
          init: function(backendSrv, playlistSrv, $route) {
            var playlistId = $route.current.params.id;

            return backendSrv.get('/api/playlists/' + playlistId)
              .then(function(playlist) {
                return backendSrv.get('/api/playlists/' + playlistId + '/dashboards')
                  .then(function(dashboards) {
                    playlistSrv.start(dashboards, playlist.timespan);
                  });
              });
          }
        }
      });
  });
});
