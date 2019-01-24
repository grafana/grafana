import coreModule from '../../core/core_module';
import kbn from 'app/core/utils/kbn';
import appEvents from 'app/core/app_events';
import _ from 'lodash';
import { toUrlParams } from 'app/core/utils/url';

export class PlaylistSrv {
  private cancelPromise: any;
  private dashboards: Array<{ uri: string }>;
  private index: number;
  private interval: number;
  private startUrl: string;
  private numberOfLoops = 0;
  isPlaying: boolean;

  /** @ngInject */
  constructor(private $location: any, private $timeout: any, private backendSrv: any) {}

  next() {
    this.$timeout.cancel(this.cancelPromise);

    const playedAllDashboards = this.index > this.dashboards.length - 1;
    if (playedAllDashboards) {
      this.numberOfLoops++;

      // This does full reload of the playlist to keep memory in check due to existing leaks but at the same time
      // we do not want page to flicker after each full loop.
      if (this.numberOfLoops >= 3) {
        window.location.href = this.startUrl;
        return;
      }
      this.index = 0;
    }

    const dash = this.dashboards[this.index];
    const queryParams = this.$location.search();
    const filteredParams = _.pickBy(queryParams, value => value !== null);

    this.$location.url('dashboard/' + dash.uri + '?' + toUrlParams(filteredParams));

    this.index++;
    this.cancelPromise = this.$timeout(() => this.next(), this.interval);
  }

  prev() {
    this.index = Math.max(this.index - 2, 0);
    this.next();
  }

  start(playlistId) {
    this.stop();

    this.startUrl = window.location.href;
    this.index = 0;
    this.isPlaying = true;

    return this.backendSrv.get(`/api/playlists/${playlistId}`).then(playlist => {
      return this.backendSrv.get(`/api/playlists/${playlistId}/dashboards`).then(dashboards => {
        this.dashboards = dashboards;
        this.interval = kbn.interval_to_ms(playlist.interval);
        this.next();
      });
    });
  }

  stop() {
    if (this.isPlaying) {
      const queryParams = this.$location.search();
      if (queryParams.kiosk) {
        appEvents.emit('toggle-kiosk-mode', { exit: true });
      }
    }

    this.index = 0;
    this.isPlaying = false;

    if (this.cancelPromise) {
      this.$timeout.cancel(this.cancelPromise);
    }
  }
}

coreModule.service('playlistSrv', PlaylistSrv);
