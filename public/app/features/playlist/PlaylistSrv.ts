import { type Location } from 'history';
import { pickBy } from 'lodash';

import { type Slideshow } from '@grafana/api-clients/rtkq/collections/v1alpha1';
import { locationUtil, urlUtil, rangeUtil } from '@grafana/data';
import { getPlaylistItemKind, locationService } from '@grafana/runtime';
import { StateManagerBase } from 'app/core/services/StateManagerBase';

import { type Playlist } from '../../api/clients/playlist/v1';

import { loadDashboards } from './utils';

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

/** An item ready to play: an in-app url and how long to stay on it, when it differs from the default. */
interface PlayableItem {
  url: string;
  interval?: string;
}

type SlideshowToPlay = { spec: Pick<Slideshow['spec'], 'interval' | 'items'> };

export class PlaylistSrv extends StateManagerBase<PlaylistSrvState> {
  private nextTimeoutId: ReturnType<typeof setTimeout> | undefined;
  private items: PlayableItem[] = []; // the items we need to load
  private index = 0;
  declare private interval: number;
  // Kiosk and display options are read once at start, because a page that rewrites its own url
  // can drop them from the location.
  private preservedParams: Record<string, unknown> = {};
  declare private startUrl: string;
  private numberOfLoops = 0;
  declare private validPlaylistUrl: string;
  private locationListenerUnsub?: () => void;

  public constructor() {
    super({ isPlaying: false });

    this.locationUpdated = this.locationUpdated.bind(this);
  }

  private navigateToDashboard(replaceHistoryEntry = false) {
    const item = this.items[this.index];
    const nextDashboardUrl = locationUtil.stripBaseFromUrl(item.url);

    this.index++;
    this.validPlaylistUrl = nextDashboardUrl;
    this.nextTimeoutId = setTimeout(
      () => this.next(),
      item.interval ? rangeUtil.intervalToMs(item.interval) : this.interval
    );

    const urlWithParams = nextDashboardUrl + '?' + urlUtil.toUrlParams(this.preservedParams);

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

    const playedAllDashboards = this.index > this.items.length - 1;
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
  locationUpdated(location: Location, action?: string) {
    if (location.pathname === this.validPlaylistUrl) {
      return;
    }

    // A page that corrects its own url does so with a replace. Anything else, such as a click,
    // pushes a new entry and ends the playlist.
    if (action === 'REPLACE') {
      this.validPlaylistUrl = location.pathname;
      return;
    }

    this.stop();
  }

  /** Plays a dashboard playlist. */
  async start(playlist: Playlist) {
    if (!playlist.spec?.items?.length) {
      this.stop();
      return;
    }

    this.begin();
    const items: PlayableItem[] = [];
    for (const item of await loadDashboards(playlist.spec.items)) {
      for (const dash of item.dashboards ?? []) {
        items.push({ url: dash.url, interval: item.interval });
      }
    }

    this.play(items, playlist.spec.interval);
  }

  /**
   * Plays a slideshow. Items whose kind is not registered, that no longer exist, or that the
   * viewer cannot open are left out.
   */
  async startSlideshow(slideshow: SlideshowToPlay) {
    this.begin();

    const resolved = await Promise.all(
      slideshow.spec.items.map(async (item): Promise<PlayableItem | undefined> => {
        const kind = getPlaylistItemKind(item.group, item.resource);
        if (!kind) {
          return undefined;
        }
        try {
          const found = await kind.resolve(item.name);
          return found ? { url: found.url, interval: item.interval } : undefined;
        } catch (err) {
          console.warn(`Could not resolve slideshow item ${item.group}/${item.resource}/${item.name}`, err);
          return undefined;
        }
      })
    );

    this.play(
      resolved.filter((item) => item !== undefined),
      slideshow.spec.interval
    );
  }

  private begin() {
    this.stop();

    this.startUrl = window.location.href;
    this.index = 0;
    this.preservedParams = pickBy(
      locationService.getSearchObject(),
      (value: unknown, key: string) => queryParamsToPreserve[key]
    );

    this.setState({ isPlaying: true });

    // setup location tracking
    this.locationListenerUnsub = locationService.getHistory().listen(this.locationUpdated);
  }

  private play(items: PlayableItem[], interval: string) {
    if (!items.length) {
      // alert... not found, etc
      this.stop();
      return;
    }

    this.interval = rangeUtil.intervalToMs(interval);
    this.items = items;

    // Replace current history entry with first dashboard instead of pushing
    // this is to avoid the back button to go back to the playlist start page which causes a redirection
    this.navigateToDashboard(true);
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
