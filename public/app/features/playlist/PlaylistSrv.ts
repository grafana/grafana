import { type Location } from 'history';
import { pickBy } from 'lodash';

import { locationUtil, urlUtil, rangeUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { StateManagerBase } from 'app/core/services/StateManagerBase';

import { type Playlist } from '../../api/clients/playlist/v1';

import { isValidInterval, loadDashboards } from './utils';

// Fallback used when even the global interval is unparseable. Matches the '5m' form default.
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

const queryParamsToPreserve: { [key: string]: boolean } = {
  kiosk: true,
  autofitpanels: true,
  orgId: true,
  hideLogo: true,
  '_dash.hideTimePicker': true,
  '_dash.hideVariables': true,
  '_dash.hideLinks': true,
  '_dash.hidePlaylistNav': true,
};

export interface PlaylistSrvState {
  isPlaying: boolean;
}

export class PlaylistSrv extends StateManagerBase<PlaylistSrvState> {
  private nextTimeoutId: ReturnType<typeof setTimeout> | undefined;
  // The dashboards we need to load, each with the interval (ms) it should stay on screen.
  private entries: Array<{ url: string; interval: number }> = [];
  private index = 0;
  declare private startUrl: string;
  private numberOfLoops = 0;
  declare private validPlaylistUrl: string;
  private locationListenerUnsub?: () => void;

  public constructor() {
    super({ isPlaying: false });

    this.locationUpdated = this.locationUpdated.bind(this);
  }

  // Parse an interval string to ms, falling back when it's empty or unparseable.
  private toIntervalMs(value: string | undefined, fallback: number): number {
    return value && isValidInterval(value) ? rangeUtil.intervalToMs(value) : fallback;
  }

  private navigateToDashboard(replaceHistoryEntry = false) {
    const entry = this.entries[this.index];
    const queryParams = locationService.getSearchObject();
    const filteredParams = pickBy(queryParams, (value: unknown, key: string) => queryParamsToPreserve[key]);
    const nextDashboardUrl = locationUtil.stripBaseFromUrl(entry.url);

    this.index++;
    this.validPlaylistUrl = nextDashboardUrl;
    this.nextTimeoutId = setTimeout(() => this.next(), entry.interval);

    const urlWithParams = nextDashboardUrl + '?' + urlUtil.toUrlParams(filteredParams);

    // When starting the playlist from the PlaylistStartPage component using the playlist URL, we want to replace the
    // history entry to support the back button
    // When starting the playlist from the playlist modal, we want to push a new history entry
    if (replaceHistoryEntry) {
      locationService.getHistory().replace(urlWithParams);
    } else {
      locationService.push(urlWithParams);
    }
  }

  next() {
    clearTimeout(this.nextTimeoutId);

    const playedAllDashboards = this.index > this.entries.length - 1;
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

    this.navigateToDashboard();
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

  async start(playlist: Playlist) {
    this.stop();

    this.startUrl = window.location.href;
    this.index = 0;

    if (!playlist.spec?.items?.length) {
      // alert
      return;
    }

    // Global interval used as the fallback for items that don't define their own.
    // Parsing is guarded: an unparseable value (e.g. from a hand-edited or provisioned
    // playlist) must not throw here and leave the service in a half-playing state.
    const globalInterval = this.toIntervalMs(playlist.spec?.interval, DEFAULT_INTERVAL_MS);

    let items;
    try {
      items = await loadDashboards(playlist.spec.items);
    } catch {
      // Could not resolve the dashboards; nothing to play.
      return;
    }

    const entries: Array<{ url: string; interval: number }> = [];
    for (const item of items) {
      if (item.dashboards) {
        // A tag item can expand to several dashboards; they all share the item's interval.
        // An invalid per-item interval falls back to the global one.
        const interval = this.toIntervalMs(item.interval, globalInterval);
        for (const dash of item.dashboards) {
          entries.push({ url: dash.url, interval });
        }
      }
    }

    if (!entries.length) {
      // alert... not found, etc
      return;
    }

    // Only enter the playing state once the playlist is known to be playable, so an early
    // return above can never leave the service half-playing (state set, listener attached).
    this.entries = entries;
    this.setState({ isPlaying: true });
    this.locationListenerUnsub = locationService.getHistory().listen(this.locationUpdated);

    // Replace current history entry with first dashboard instead of pushing
    // this is to avoid the back button to go back to the playlist start page which causes a redirection
    this.navigateToDashboard(true);
    return;
  }

  stop() {
    if (!this.state.isPlaying) {
      return;
    }

    this.index = 0;

    this.setState({ isPlaying: false });

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
