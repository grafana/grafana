import _ from 'lodash';
import coreModule from '../../core/core_module';
import { BackendSrv } from '@grafana/runtime';
import { NavModelSrv } from 'app/core/nav_model_srv';

export class PlaylistsCtrl {
  playlists: any;
  navModel: any;

  //angular is evaluating these expressions and they need to be references instead of string literals directly
  emptyListCta = {
    title: 'There are no playlists created yet',
    buttonIcon: 'fa fa-plus',
    buttonLink: 'playlists/create',
    buttonTitle: ' Create Playlist',
    proTip: 'You can use playlists to cycle dashboards on TVs without user control',
    proTipLink: 'http://docs.grafana.org/reference/playlist/',
    proTipLinkTitle: 'Learn more',
    proTipTarget: '_blank',
  };

  /** @ngInject */
  constructor(private $scope: any, private backendSrv: BackendSrv, navModelSrv: NavModelSrv) {
    this.navModel = navModelSrv.getNav('dashboards', 'playlists', 0);

    backendSrv.get('/api/playlists').then((result: any) => {
      this.playlists = result.map((item: any) => {
        item.startUrl = `playlists/play/${item.id}`;
        return item;
      });
    });
  }

  removePlaylistConfirmed(playlist: any) {
    _.remove(this.playlists, { id: playlist.id });

    this.backendSrv.delete('/api/playlists/' + playlist.id).then(
      () => {
        this.$scope.appEvent('alert-success', ['Playlist deleted', '']);
      },
      () => {
        this.$scope.appEvent('alert-error', ['Unable to delete playlist', '']);
        this.playlists.push(playlist);
      }
    );
  }

  removePlaylist(playlist: any) {
    this.$scope.appEvent('confirm-modal', {
      title: 'Delete',
      text: 'Are you sure you want to delete playlist ' + playlist.name + '?',
      yesText: 'Delete',
      icon: 'fa-trash',
      onConfirm: () => {
        this.removePlaylistConfirmed(playlist);
      },
    });
  }
}

coreModule.controller('PlaylistsCtrl', PlaylistsCtrl);
