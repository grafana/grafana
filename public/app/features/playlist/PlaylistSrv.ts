import { type Location } from 'history';
import { pickBy } from 'lodash';

import { locationUtil, urlUtil, rangeUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
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

function addQueryParams(url: string, params?: Record<string, string>) {
  if (!params || Object.keys(params).length === 0) {
    return url;
  }

  return urlUtil.renderUrl(url, params);
}

export interface PlaylistSrvState {
  isPlaying: boolean;
}

export class PlaylistSrv extends StateManagerBase<PlaylistSrvState> {
  private nextTimeoutId: ReturnType<typeof setTimeout> | undefined;
  private urls: string[] = []; // the URLs we need to load
  private index = 0;
  declare private interval: number;
  declare private startUrl: string;
  private numberOfLoops = 0;
  declare private validPlaylistUrl: string;
  private locationListenerUnsub?: () => void;

  public constructor() {
    super({ isPlaying: false });

    this.locationUpdated = this.locationUpdated.bind(this);
  }

  private navigateToDashboard(replaceHistoryEntry = false) {
    const url = this.urls[this.index];
    const queryParams = locationService.getSearchObject();
    const filteredParams = pickBy(queryParams, (value: unknown, key: string) => queryParamsToPreserve[key]);
    // Dashboard URLs may carry their own query params (e.g. variable/time range sets applied
    // during playback), so split them off and merge them with the preserved runtime params.
    const [nextDashboardUrl, nextDashboardQuery] = locationUtil.stripBaseFromUrl(url).split('?');
    const dashboardParams = urlUtil.toUrlParams({
      ...urlUtil.parseKeyValue(nextDashboardQuery ?? ''),
      ...filteredParams,
    });

    this.index++;
    this.validPlaylistUrl = nextDashboardUrl;
    this.nextTimeoutId = setTimeout(() => this.next(), this.interval);

    const urlWithParams = dashboardParams ? `${nextDashboardUrl}?${dashboardParams}` : nextDashboardUrl;

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

    this.setState({ isPlaying: true });

    // setup location tracking
    this.locationListenerUnsub = locationService.getHistory().listen(this.locationUpdated);
    const urls: string[] = [];

    if (!playlist.spec?.items?.length) {
      // alert
      return;
    }

    this.interval = rangeUtil.intervalToMs(playlist.spec?.interval);

    const items = await loadDashboards(playlist.spec?.items);
    const variableSets = playlist.spec.variableSets?.filter((set) => Object.keys(set.queryParams).length > 0);
    for (const item of items) {
      if (item.dashboards) {
        for (const dash of item.dashboards) {
          if (variableSets?.length) {
            // Show each dashboard once per configured variable/time range set
            for (const variableSet of variableSets) {
              urls.push(addQueryParams(dash.url, variableSet.queryParams));
            }
          } else {
            urls.push(dash.url);
          }
        }
      }
    }

    if (!urls.length) {
      // alert... not found, etc
      return;
    }

    this.urls = urls;
    this.setState({ isPlaying: true });

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
