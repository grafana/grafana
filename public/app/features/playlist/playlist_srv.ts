///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import coreModule from '../../core/core_module';
import kbn from 'app/core/utils/kbn';
import appEvents from 'app/core/app_events';

class PlaylistSrv {
  private cancelPromise: any;
  private dashboards: any;
  private index: number;
  private interval: any;
  private playlistId: number;
  private startUrl: string;
  public isPlaying: boolean;

  /** @ngInject */
  constructor(
    private $rootScope: any,
    private $location: any,
    private $timeout: any,
    private backendSrv: any,
    private $routeParams: any
    ) { }

  next() {
    this.$timeout.cancel(this.cancelPromise);

    var playedAllDashboards = this.index > this.dashboards.length - 1;

    if (playedAllDashboards) {
      window.location.href = this.getUrlWithKioskMode();
      return;
    }

    var dash = this.dashboards[this.index];
    this.$location.url('dashboard/' + dash.uri);

    this.index++;
    this.cancelPromise = this.$timeout(() => this.next(), this.interval);
  }

  getUrlWithKioskMode() {
    const inKioskMode = document.body.classList.contains('page-kiosk-mode');

    // check if should add kiosk query param
    if (inKioskMode && this.startUrl.indexOf('kiosk') === -1) {
      return this.startUrl + '?kiosk=true';
    }

    // check if should remove kiosk query param
    if (!inKioskMode) {
      return this.startUrl.split("?")[0];
    }

    // already has kiosk query param, just return startUrl
    return this.startUrl;
  }

  prev() {
    this.index = Math.max(this.index - 2, 0);
    this.next();
  }

  start(playlistId) {
    this.stop();

    this.startUrl = window.location.href;
    this.index = 0;
    this.playlistId = playlistId;
    this.isPlaying = true;

    if (this.$routeParams.kiosk) {
      appEvents.emit('toggle-kiosk-mode');
    }

    this.backendSrv.get(`/api/playlists/${playlistId}`).then(playlist => {
      this.backendSrv.get(`/api/playlists/${playlistId}/dashboards`).then(dashboards => {
        this.dashboards = dashboards;
        this.interval = kbn.interval_to_ms(playlist.interval);
        this.next();
      });
    });
  }

  stop() {
    this.index = 0;
    this.isPlaying = false;
    this.playlistId = 0;

    if (this.cancelPromise) {
      this.$timeout.cancel(this.cancelPromise);
    }
  }
}

coreModule.service('playlistSrv', PlaylistSrv);
