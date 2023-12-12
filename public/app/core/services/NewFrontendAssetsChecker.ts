import { getBackendSrv, getGrafanaLiveSrv } from '@grafana/runtime';

export class NewFrontendAssetsChecker {
  private hasUpdates = false;
  private previous = '?';
  private checked = 0;
  private interval = 1000; // check interval

  public start() {
    let prevState: boolean | undefined;

    // Subscribe to live connection state changes and check for new assets when re-connected
    const live = getGrafanaLiveSrv();
    if (live) {
      live.getConnectionState().subscribe((connected) => {
        if (connected && connected !== prevState) {
          this._checkForUpdates();
        }
      });
    }
  }

  private async _checkForUpdates() {
    if (this.hasUpdates) {
      return;
    }

    const resultRaw = await getBackendSrv().get('/api/frontend/assets');
    const result = JSON.stringify(resultRaw);
    if (this.checked && this.previous !== result) {
      this.hasUpdates = true;
      console.log('updates detected', true);
    }
    this.previous = result;
    this.checked = Date.now();
  }

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
