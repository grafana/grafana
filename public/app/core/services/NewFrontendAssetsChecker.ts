import { Location } from 'history';

import { getBackendSrv, getGrafanaLiveSrv, locationService } from '@grafana/runtime';

export class NewFrontendAssetsChecker {
  private hasUpdates = false;
  private previous = '';
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
    const newLocationSegments = location.pathname.split('/');
    const prevLocationSegments = this.prevLocationPath.split('/');

    this.prevLocationPath = location.pathname;

    // We are going to home
    if (newLocationSegments[1] === '/') {
      this.reloadIfUpdateDetected();
    }
    // if we are going to a new section (ignore plugin sections for now)
    else if (newLocationSegments[1] !== prevLocationSegments[1] && newLocationSegments[1] !== '/a') {
      this.reloadIfUpdateDetected();
    }
    // Moving to another dashboard
    else if (newLocationSegments[1] === 'd' && newLocationSegments[2] !== prevLocationSegments[2]) {
      this.reloadIfUpdateDetected();
    }
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

    const resultRaw = await getBackendSrv().get('/api/frontend/assets');
    const result = JSON.stringify(resultRaw);

    if (this.previous?.length && this.previous !== result) {
      this.hasUpdates = true;
    }

    this.previous = result;
  }

  /** This is called on page navigation events */
  public reloadIfUpdateDetected() {
    if (this.hasUpdates) {
      window.location.reload();
    }

    // Async check if the assets have changed
    this._checkForUpdates();
  }
}
