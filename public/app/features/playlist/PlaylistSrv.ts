import { type Location } from 'history';
import { pickBy } from 'lodash';

import { locationUtil, urlUtil, rangeUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { StateManagerBase } from 'app/core/services/StateManagerBase';

import { type Playlist } from '../../api/clients/playlist/v1';

import {
  isValidInterval,
  loadDashboards,
  normalizeDashboardViewQueryString,
  PLAYLIST_RUNTIME_QUERY_PARAMS,
} from './utils';

// Fallback used when even the global interval is unparseable. Matches the '5m' form default.
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

export interface PlaylistSrvState {
  isPlaying: boolean;
}

interface PlaylistEntry {
  url: string;
  interval: number;
  queryString?: string;
}

export class PlaylistSrv extends StateManagerBase<PlaylistSrvState> {
  private nextTimeoutId: ReturnType<typeof setTimeout> | undefined;
  private entries: PlaylistEntry[] = [];
  private index = 0;
  declare private startUrl: string;
  private numberOfLoops = 0;
  declare private validPlaylistUrl: string;
  private locationListenerUnsub?: () => void;
  private startRequestId = 0;

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
    const filteredParams = pickBy(queryParams, (value: unknown, key: string) => PLAYLIST_RUNTIME_QUERY_PARAMS.has(key));
    const strippedUrl = locationUtil.stripBaseFromUrl(entry.url);
    const queryStart = strippedUrl.indexOf('?');
    const nextDashboardUrl = queryStart === -1 ? strippedUrl : strippedUrl.slice(0, queryStart);
    const dashboardParams = queryStart === -1 ? {} : urlUtil.parseKeyValue(strippedUrl.slice(queryStart + 1));

    this.index++;
    this.validPlaylistUrl = nextDashboardUrl;
    this.nextTimeoutId = setTimeout(() => this.next(), entry.interval);

    const urlWithParams = urlUtil.renderUrl(nextDashboardUrl, {
      ...dashboardParams,
      ...urlUtil.parseKeyValue(normalizeDashboardViewQueryString(entry.queryString) ?? ''),
      ...filteredParams,
    });

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
    const requestId = ++this.startRequestId;

    // Do all async work up front, before touching any instance state. This means an early return
    // can never leave the service half-playing, and the synchronous tail below can't interleave
    // with a concurrent start() (PlaylistStartPage calls start() during render).
    if (!playlist.spec?.items?.length) {
      // alert
      return;
    }

    // Global interval used as the fallback for items that don't define their own. Parsing is
    // guarded so an unparseable value (e.g. from a hand-edited or provisioned playlist) can't throw.
    const globalInterval = this.toIntervalMs(playlist.spec.interval, DEFAULT_INTERVAL_MS);

    let items;
    try {
      items = await loadDashboards(playlist.spec.items);
    } catch {
      // Could not resolve the dashboards; nothing to play.
      return;
    }

    if (requestId !== this.startRequestId) {
      return;
    }

    const entries: PlaylistEntry[] = [];
    for (const item of items) {
      if (item.dashboards) {
        // A tag item can expand to several dashboards; they all share the item's interval.
        // An invalid per-item interval falls back to the global one.
        const interval = this.toIntervalMs(item.interval, globalInterval);
        for (const dash of item.dashboards) {
          entries.push({ url: dash.url, interval, queryString: item.dashboardView?.queryString });
        }
      }
    }

    if (!entries.length) {
      // alert... not found, etc
      return;
    }

    // Synchronous from here on: tear down any previous run, then set up this one. With no await in
    // this tail, an overlapping start() can't interleave — the later one's stop() cleans up the
    // earlier, so there's always exactly one playback with one listener/timeout.
    this.stopPlayback();
    this.startUrl = window.location.href;
    this.index = 0;
    this.entries = entries;
    this.setState({ isPlaying: true });
    this.locationListenerUnsub = locationService.getHistory().listen(this.locationUpdated);

    // Replace current history entry with first dashboard instead of pushing
    // this is to avoid the back button to go back to the playlist start page which causes a redirection
    this.navigateToDashboard(true);
  }

  stop() {
    this.startRequestId++;
    this.stopPlayback();
  }

  private stopPlayback() {
    if (!this.state.isPlaying) {
      return;
    }

    this.index = 0;
    this.setState({ isPlaying: false });

    if (this.locationListenerUnsub) {
      this.locationListenerUnsub();
      this.locationListenerUnsub = undefined;
    }

    if (this.nextTimeoutId) {
      clearTimeout(this.nextTimeoutId);
      this.nextTimeoutId = undefined;
    }

    if (locationService.getSearchObject().kiosk) {
      locationService.partial({ kiosk: null });
    }
  }
}

export const playlistSrv = new PlaylistSrv();
