import { BehaviorSubject } from 'rxjs';

import { config, locationService } from '@grafana/runtime';

export class SidecarService {
  // The ID of the app plugin that is currently opened in the sidecar view
  private _activePluginId: BehaviorSubject<string | undefined>;

  constructor() {
    this._activePluginId = new BehaviorSubject<string | undefined>(undefined);
  }

  private assertFeatureEnabled() {
    if (!config.featureToggles.appSidecar) {
      console.warn('The `appSidecar` feature toggle is not enabled, doing nothing.');
      return false;
    }

    return true;
  }

  get activePluginId() {
    return this._activePluginId.asObservable();
  }

  openApp(pluginId: string) {
    if (!this.assertFeatureEnabled()) {
      return false;
    }

    return this._activePluginId.next(pluginId);
  }

  closeApp(pluginId: string) {
    if (!this.assertFeatureEnabled()) {
      return false;
    }

    if (this._activePluginId.getValue() === pluginId) {
      return this._activePluginId.next(undefined);
    }
  }

  isAppOpened(pluginId: string) {
    if (!this.assertFeatureEnabled()) {
      return false;
    }

    if (this._activePluginId.getValue() === pluginId || getMainAppPluginId() === pluginId) {
      return true;
    }

    return false;
  }
}

export const sidecarService = new SidecarService();

// The app plugin that is "open" in the main Grafana view
function getMainAppPluginId() {
  const { pathname } = locationService.getLocation();

  // A naive way to sort of simulate core features being an app and having an appID
  let mainApp = pathname.match(/\/a\/([^/]+)/)?.[1];
  if (!mainApp && pathname.match(/\/explore/)) {
    mainApp = 'explore';
  }

  if (!mainApp && pathname.match(/\/d\//)) {
    mainApp = 'dashboards';
  }

  return mainApp || 'unknown';
}
