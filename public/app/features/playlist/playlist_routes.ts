// TODO[Router]
// import { RouteDescriptor } from 'app/core/navigation/types';
//
// export const playlistRoutes: RouteDescriptor[] = [
//   {
//     path: '/playlists',
//     templateUrl: 'public/app/features/playlist/partials/playlists.html',
//     controllerAs: 'ctrl',
//     controller: 'PlaylistsCtrl',
//   },
//   {
//     path: '/playlists/create',
//     templateUrl: 'public/app/features/playlist/partials/playlist.html',
//     controllerAs: 'ctrl',
//     controller: 'PlaylistEditCtrl',
//   },
//   {
//     path: '/playlists/edit/:id',
//     templateUrl: 'public/app/features/playlist/partials/playlist.html',
//     controllerAs: 'ctrl',
//     controller: 'PlaylistEditCtrl',
//   },
//   {
//     path: '/playlists/play/:id',
//     template: '',
//     resolve: {
//       init: (playlistSrv: PlaylistSrv, $route: any) => {
//         const playlistId = $route.current.params.id;
//         playlistSrv.start(playlistId);
//       },
//     },
//   },
// ];
