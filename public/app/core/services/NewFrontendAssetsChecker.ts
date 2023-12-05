import { isEqual } from 'lodash';

import { getBackendSrv, getGrafanaLiveSrv } from '@grafana/runtime';

import { config } from '../config';

export class NewFrontendAssetsChecker {
  private _hasUpdates = false;

  public start() {
    let prevState: boolean | undefined;

    // Subscribe to live connecttion state changes and check for new assets when re-connected
    getGrafanaLiveSrv()
      .getConnectionState()
      .subscribe((connected) => {
        if (connected && connected !== prevState) {
          this._checkForUpdates();
        }
      });
  }

  private async _checkForUpdates() {
    if (this._hasUpdates) {
      return;
    }

    const result = await getBackendSrv().get('/api/frontend/assets');

    if (!isEqual(result, config.bootData.assets)) {
      this._hasUpdates = true;
      console.log('updates detected', true);
    }
  }

  public reloadIfUpdateDetected() {
    if (this._hasUpdates) {
      window.location.reload();
    }
  }
}
