import angular from 'angular';
import { PlaylistSrv } from './playlist_srv';

/** @ngInject */
function grafanaRoutes($routeProvider: any) {
  $routeProvider
    .when('/playlists', {
      templateUrl: 'public/app/features/playlist/partials/playlists.html',
      controllerAs: 'ctrl',
      controller: 'PlaylistsCtrl',
    })
    .when('/playlists/create', {
      templateUrl: 'public/app/features/playlist/partials/playlist.html',
      controllerAs: 'ctrl',
      controller: 'PlaylistEditCtrl',
    })
    .when('/playlists/edit/:id', {
      templateUrl: 'public/app/features/playlist/partials/playlist.html',
      controllerAs: 'ctrl',
      controller: 'PlaylistEditCtrl',
    })
    .when('/playlists/play/:id', {
      template: '',
      resolve: {
        init: (playlistSrv: PlaylistSrv, $route: any) => {
          const playlistId = $route.current.params.id;
          playlistSrv.start(playlistId);
        },
      },
    });
}

angular.module('grafana.routes').config(grafanaRoutes);
