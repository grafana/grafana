define([
  'angular',
  'config',
  'lodash'
],
function (angular, config, _) {
  'use strict';

  var module = angular.module('grafana.routes');

  module.config(function($routeProvider) {
    $routeProvider
      .when('/playlists', {
        templateUrl: 'app/features/playlist/partials/playlists.html',
        controller : 'PlaylistsCtrl',
        resolve: {
          playlists: function (backendSrv) {
            return backendSrv.get('/api/playlists');
          }
        }
      })
      .when('/playlists/create', {
        templateUrl: 'app/features/playlist/partials/playlist.html',
        controller : 'PlaylistEditCtrl',
        resolve: {
          playlist: function() {
            return {
              timespan: '1m'
            };
          },
          dashboards: function() {
            return [];
          }
        }
      })
      .when('/playlists/edit/:id', {
        templateUrl: 'app/features/playlist/partials/playlist.html',
        controller : 'PlaylistEditCtrl',
        resolve: {
          playlist: function(backendSrv, $route) {
            var playlistId = $route.current.params.id;

            return backendSrv.get('/api/playlists/' + playlistId);
          },
          dashboards: function(backendSrv, $route) {
            var playlistId = $route.current.params.id;

            return backendSrv.get('/api/playlists/' + playlistId + '/dashboards');
          }
        }
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
                    _.each(dashboards, function(dashboard) {
                      dashboard.uri = 'db/' + dashboard.slug;
                    });
                    playlistSrv.start(dashboards, playlist.timespan);
                  });
              });
          }
        }
      });
  });
});
