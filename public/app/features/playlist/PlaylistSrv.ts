import { Location } from 'history';
import { pickBy } from 'lodash';

import { locationUtil, urlUtil, rangeUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { getPlaylist, loadDashboards } from './api';

export const queryParamsToPreserve: { [key: string]: boolean } = {
  kiosk: true,
  autofitpanels: true,
  orgId: true,
};

export class PlaylistSrv {
  private nextTimeoutId: ReturnType<typeof setTimeout> | undefined;
  private urls: string[] = []; // the URLs we need to load
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

    const playedAllDashboards = this.index > this.urls.length - 1;
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

    const url = this.urls[this.index];
    const queryParams = locationService.getSearchObject();
    const filteredParams = pickBy(queryParams, (value: unknown, key: string) => queryParamsToPreserve[key]);
    const nextDashboardUrl = locationUtil.stripBaseFromUrl(url);

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

  async start(playlistUid: string) {
    this.stop();

    this.startUrl = window.location.href;
    this.index = 0;
    this.isPlaying = true;

    // setup location tracking
    this.locationListenerUnsub = locationService.getHistory().listen(this.locationUpdated);

    const urls: string[] = [];
    let playlist = await getPlaylist(playlistUid);
    if (!playlist.items?.length) {
      // alert
      return;
    }
    this.interval = rangeUtil.intervalToMs(playlist.interval);

    const items = await loadDashboards(playlist.items);
    for (const item of items) {
      if (item.dashboards) {
        for (const dash of item.dashboards) {
          urls.push(dash.url);
        }
      }
    }

    if (!urls.length) {
      // alert... not found, etc
      return;
    }
    this.urls = urls;
    this.isPlaying = true;
    this.next();
    return;
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
