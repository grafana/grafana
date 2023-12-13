import { getBackendSrv, getGrafanaLiveSrv } from '@grafana/runtime';

export class NewFrontendAssetsChecker {
  private hasUpdates = false;
  private previous = '';
  private interval = 1000 * 60 * 4; // force check after 5 mins
  private checked = Date.now() - this.interval / 5;

  public start() {
    const startup = Date.now();
    let prevState = false;

    // Subscribe to live connection state changes and check for new assets when re-connected
    const live = getGrafanaLiveSrv();
    if (live) {
      live.getConnectionState().subscribe((connected) => {
        const elapsed = Date.now() - startup;
        if (elapsed > 1000 && connected && connected !== prevState) {
          this._checkForUpdates();
        }
        prevState = connected;
      });
    }
  }

  private async _checkForUpdates() {
    if (this.hasUpdates) {
      return;
    }

    const resultRaw = await getBackendSrv().get('/api/frontend/assets');
    const result = JSON.stringify(resultRaw);
    if (this.previous?.length && this.previous !== result) {
      this.hasUpdates = true;
    }
    this.previous = result;
    this.checked = Date.now();
  }

  /** This is called on page navigation events */
  public reloadIfUpdateDetected() {
    if (this.hasUpdates) {
      window.location.reload();
    }

    // Async check if the assets have changed
    if (Date.now() - this.checked > this.interval) {
      this._checkForUpdates();
    }
  }
}
