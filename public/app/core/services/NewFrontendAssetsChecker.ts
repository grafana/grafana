import { Location } from 'history';
import { isEqual } from 'lodash';

import { getBackendSrv, getGrafanaLiveSrv, locationService, reportInteraction } from '@grafana/runtime';

export class NewFrontendAssetsChecker {
  private hasUpdates = false;
  private previous?: FrontendAssetsAPIDTO;
  private interval: number;
  private checked = Date.now();
  private prevLocationPath = '';

  public constructor(interval?: number) {
    // Default to never check for updates if last check was 5 minutes ago
    this.interval = interval ?? 1000 * 60 * 5;
  }

  public start() {
    // Subscribe to live connection state changes and check for new assets when re-connected
    const live = getGrafanaLiveSrv();

    if (live) {
      live.getConnectionState().subscribe((connected) => {
        if (connected) {
          this._checkForUpdates();
        }
      });
    }

    // Subscribe to location changes
    locationService.getHistory().listen(this.locationUpdated.bind(this));
    this.prevLocationPath = locationService.getLocation().pathname;
  }

  /**
   * Tries to detect some navigation events where it's safe to trigger a reload
   */
  private locationUpdated(location: Location) {
    if (this.prevLocationPath === location.pathname) {
      return;
    }

    const newLocationSegments = location.pathname.split('/');

    // We are going to home
    if (newLocationSegments[1] === '/' && this.prevLocationPath !== '/') {
      this.reloadIfUpdateDetected();
    }
    // Moving to dashboard (or changing dashboards)
    else if (newLocationSegments[1] === 'd') {
      this.reloadIfUpdateDetected();
    }
    // Track potential page change
    else if (this.hasUpdates) {
      reportInteraction('new_frontend_assets_reload_ignored', {
        newLocation: location.pathname,
        prevLocation: this.prevLocationPath,
      });
    }

    this.prevLocationPath = location.pathname;
  }

  private async _checkForUpdates() {
    if (this.hasUpdates) {
      return;
    }

    // Don't check too often
    if (Date.now() - this.checked < this.interval) {
      return;
    }

    this.checked = Date.now();

    const previous = this.previous;
    const result: FrontendAssetsAPIDTO = await getBackendSrv().get('/api/frontend/assets');

    if (previous && !isEqual(previous, result)) {
      this.hasUpdates = true;

      // Report that we detected new assets
      reportInteraction('new_frontend_assets_detected', {
        assets: previous.assets !== result.assets,
        plugins: previous.plugins !== result.plugins,
        version: previous.version !== result.version,
        flags: previous.flags !== result.flags,
      });
    }

    this.previous = result;
  }

  /** This is called on page navigation events */
  public reloadIfUpdateDetected() {
    if (this.hasUpdates) {
      // Report that we detected new assets
      reportInteraction('new_frontend_assets_reload', {});
      window.location.reload();
    }

    // Async check if the assets have changed
    this._checkForUpdates();
  }
}

interface FrontendAssetsAPIDTO {
  assets: string;
  flags: string;
  plugins: string;
  version: string;
}
