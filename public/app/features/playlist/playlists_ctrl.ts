///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import coreModule from '../../core/core_module';

export class PlaylistsCtrl {
  playlists: any;
  navModel: any;

  /** @ngInject */
  constructor(private $scope, private $location, private backendSrv, private navModelSrv) {
    this.navModel = navModelSrv.getPlaylistsNav(0);

    backendSrv.get('/api/playlists').then(result => {
      this.playlists = result;
    });
  }

  removePlaylistConfirmed(playlist) {
    _.remove(this.playlists, { id: playlist.id });

    this.backendSrv.delete('/api/playlists/' + playlist.id)
    .then(() => {
        this.$scope.appEvent('alert-success', ['Playlist deleted', '']);
      }, () => {
        this.$scope.appEvent('alert-error', ['Unable to delete playlist', '']);
        this.playlists.push(playlist);
      });
  }

  removePlaylist(playlist) {

    this.$scope.appEvent('confirm-modal', {
      title: 'Delete',
      text: 'Are you sure you want to delete playlist ' + playlist.name + '?',
      yesText: "Delete",
      icon: "fa-trash",
      onConfirm: () => {
        this.removePlaylistConfirmed(playlist);
      }
    });
  }
}

coreModule.controller('PlaylistsCtrl', PlaylistsCtrl);
