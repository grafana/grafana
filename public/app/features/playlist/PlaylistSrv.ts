// Libraries
import { pickBy } from 'lodash';

// Utils
import { getBackendSrv, locationService } from '@grafana/runtime';
import { locationUtil, urlUtil, rangeUtil } from '@grafana/data';
import { Location } from 'history';

export const queryParamsToPreserve: { [key: string]: boolean } = {
  kiosk: true,
  autofitpanels: true,
  orgId: true,
};

export class PlaylistSrv {
  private nextTimeoutId: any;
  private declare dashboards: Array<{ url: string }>;
  private index = 0;
  private declare interval: number;
  private declare startUrl: string;
  private numberOfLoops = 0;
  private declare validPlaylistUrl: string;
  private locationListenerUnsub?: () => void;

  isPlaying = false;

  constructor() {
    this.locationUpdated = this.locationUpdated.bind(this);
  }

  next() {
    clearTimeout(this.nextTimeoutId);

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
    const queryParams = locationService.getSearchObject();
    const filteredParams = pickBy(queryParams, (value: any, key: string) => queryParamsToPreserve[key]);
    const nextDashboardUrl = locationUtil.stripBaseFromUrl(dash.url);

    this.index++;
    this.validPlaylistUrl = nextDashboardUrl;
    this.nextTimeoutId = setTimeout(() => this.next(), this.interval);

    locationService.push(nextDashboardUrl + '?' + urlUtil.toUrlParams(filteredParams));
  }

  prev() {
    this.index = Math.max(this.index - 2, 0);
    this.next();
  }

  // Detect url changes not caused by playlist srv and stop playlist
  locationUpdated(location: Location) {
    if (location.pathname !== this.validPlaylistUrl) {
      this.stop();
    }
  }

  start(playlistId: number) {
    this.stop();

    this.startUrl = window.location.href;
    this.index = 0;
    this.isPlaying = true;

    // setup location tracking
    this.locationListenerUnsub = locationService.getHistory().listen(this.locationUpdated);

    return getBackendSrv()
      .get(`/api/playlists/${playlistId}`)
      .then((playlist: any) => {
        return getBackendSrv()
          .get(`/api/playlists/${playlistId}/dashboards`)
          .then((dashboards: any) => {
            this.dashboards = dashboards;
            this.interval = rangeUtil.intervalToMs(playlist.interval);
            this.next();
          });
      });
  }

  stop() {
    if (!this.isPlaying) {
      return;
    }

    this.index = 0;
    this.isPlaying = false;

    if (this.locationListenerUnsub) {
      this.locationListenerUnsub();
    }

    if (this.nextTimeoutId) {
      clearTimeout(this.nextTimeoutId);
    }

    if (locationService.getSearchObject().kiosk) {
      locationService.partial({ kiosk: null });
    }
  }
}

export const playlistSrv = new PlaylistSrv();
