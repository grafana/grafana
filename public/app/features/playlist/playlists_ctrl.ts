import { IScope } from 'angular';
import _ from 'lodash';
import { AppEvents } from '@grafana/data';
import { OrgRole, AppEventEmitter } from 'app/types';
import { getBackendSrv } from '@grafana/runtime';

import coreModule from '../../core/core_module';
import config from '../../core/config';
import { NavModelSrv } from 'app/core/nav_model_srv';
import { promiseToDigest } from '../../core/utils/promiseToDigest';
import { appEvents } from '../../core/core';
import { ShowConfirmModalEvent } from '../../types/events';

export class PlaylistsCtrl {
  playlists: any;
  navModel: any;
  canEditPlaylists: boolean;

  /** @ngInject */
  constructor(private $scope: IScope & AppEventEmitter, navModelSrv: NavModelSrv) {
    this.navModel = navModelSrv.getNav('dashboards', 'playlists', 0);
    this.canEditPlaylists = config.bootData.user.orgRole !== OrgRole.Viewer;

    promiseToDigest($scope)(
      getBackendSrv()
        .get('/api/playlists')
        .then((result: any) => {
          this.playlists = result.map((item: any) => {
            item.startUrl = `playlists/play/${item.id}`;
            return item;
          });
        })
    );
  }

  removePlaylistConfirmed(playlist: any) {
    _.remove(this.playlists, { id: playlist.id });

    promiseToDigest(this.$scope)(
      getBackendSrv()
        .delete('/api/playlists/' + playlist.id)
        .then(
          () => {
            this.$scope.appEvent(AppEvents.alertSuccess, ['Playlist deleted']);
          },
          () => {
            this.$scope.appEvent(AppEvents.alertError, ['Unable to delete playlist']);
            this.playlists.push(playlist);
          }
        )
    );
  }

  removePlaylist(playlist: any) {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: 'Delete',
        text: 'Are you sure you want to delete playlist ' + playlist.name + '?',
        yesText: 'Delete',
        icon: 'trash-alt',
        onConfirm: () => {
          this.removePlaylistConfirmed(playlist);
        },
      })
    );
  }
}

coreModule.controller('PlaylistsCtrl', PlaylistsCtrl);
