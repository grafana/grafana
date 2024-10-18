import { BehaviorSubject, EMPTY } from 'rxjs';

import { config, locationService } from '../index';

export class SidecarService_EXPERIMENTAL {
  // The ID of the app plugin that is currently opened in the sidecar view
  private _activePluginId: BehaviorSubject<string | undefined>;
  private _initialContext: BehaviorSubject<unknown | undefined>;

  constructor() {
    this._activePluginId = new BehaviorSubject<string | undefined>(undefined);
    this._initialContext = new BehaviorSubject<unknown | undefined>(undefined);
  }

  private assertFeatureEnabled() {
    if (!config.featureToggles.appSidecar) {
      console.warn('The `appSidecar` feature toggle is not enabled, doing nothing.');
      return false;
    }

    return true;
  }

  get activePluginId() {
    if (!this.assertFeatureEnabled()) {
      return EMPTY;
    }
    return this._activePluginId.asObservable();
  }

  get initialContext() {
    if (!this.assertFeatureEnabled()) {
      return EMPTY;
    }
    return this._initialContext.asObservable();
  }

  // Get the current value of the subject, this is needed if we want the value immediately. For example if used in
  // hook in react with useObservable first render would return undefined even if the behaviourSubject has some
  // value which will be emitted in the next tick and thus next rerender.
  get initialContextCurrent() {
    if (!this.assertFeatureEnabled()) {
      return undefined;
    }
    return this._initialContext.getValue();
  }

  get activePluginIdCurrent() {
    if (!this.assertFeatureEnabled()) {
      return undefined;
    }
    return this._activePluginId.getValue();
  }

  openApp(pluginId: string, context?: unknown) {
    if (!this.assertFeatureEnabled()) {
      return;
    }

    this._activePluginId.next(pluginId);
    this._initialContext.next(context);
  }

  closeApp(pluginId: string) {
    if (!this.assertFeatureEnabled()) {
      return;
    }
    if (this._activePluginId.getValue() === pluginId) {
      this._activePluginId.next(undefined);
      this._initialContext.next(undefined);
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

export const sidecarServiceSingleton_EXPERIMENTAL = new SidecarService_EXPERIMENTAL();

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
