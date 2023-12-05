import { isEqual } from 'lodash';

import { getBackendSrv } from '@grafana/runtime';

import { config } from '../config';

export class FrontendAssetsUpdateChecker {
  private _hasUpdates = false;
  // Check every 10m
  private _updateInterval = 1 * 6 * 1000;

  public start() {
    setTimeout(this._checkForUpdates.bind(this), this._updateInterval);
  }

  private async _checkForUpdates() {
    const result = await getBackendSrv().get('/api/frontend/assets');
    if (!isEqual(result, config.bootData.assets)) {
      this._hasUpdates = true;
    }
  }
}
