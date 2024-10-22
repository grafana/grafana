import { BehaviorSubject } from 'rxjs';

import { config } from '../config';

import { locationService } from './LocationService';

interface Options {
  localStorageKey?: string;
}

/**
 * This is a service that handles state and operation of a sidecar feature (sideview to render a second app in grafana).
 * At this moment this is highly experimental and if used should be understand to break easily with newer versions.
 * None of this functionality works without a feature toggle `appSidecar` being enabled.
 *
 * Right now this being in a single service is more of a practical tradeoff for easier isolation in the future these
 * APIs may be integrated into other services or features like app extensions, plugin system etc.
 *
 * @experimental
 */
export class SidecarService_EXPERIMENTAL {
  private _activePluginId: BehaviorSubject<string | undefined>;
  private _initialContext: BehaviorSubject<unknown | undefined>;
  private localStorageKey: string | undefined;

  constructor(options: Options) {
    this.localStorageKey = options.localStorageKey;
    let initialId = undefined;
    if (this.localStorageKey) {
      initialId = localStorage.getItem(this.localStorageKey) || undefined;
    }
    this._activePluginId = new BehaviorSubject<string | undefined>(initialId);
    this._initialContext = new BehaviorSubject<unknown | undefined>(undefined);
  }

  private assertFeatureEnabled() {
    if (!config.featureToggles.appSidecar) {
      console.warn('The `appSidecar` feature toggle is not enabled, doing nothing.');
      return false;
    }

    return true;
  }

  /**
   * Get current app id of the app in sidecar. This is most probably provisional. In the future
   * this should be driven by URL addressing so that routing for the apps don't change. Useful just internally
   * to decide which app to render.
   *
   * @experimental
   */
  get activePluginIdObservable() {
    return this._activePluginId.asObservable();
  }

  /**
   * Get initial context which is whatever data was passed when calling the 'openApp' function. This is meant as
   * a way for the app to initialize it's state based on some context that is passed to it from the primary app.
   *
   * @experimental
   */
  get initialContextObservable() {
    return this._initialContext.asObservable();
  }

  // Get the current value of the subject, this is needed if we want the value immediately. For example if used in
  // hook in react with useObservable first render would return undefined even if the behaviourSubject has some
  // value which will be emitted in the next tick and thus next rerender.
  get initialContext() {
    return this._initialContext.getValue();
  }

  /**
   * @experimental
   */
  get activePluginId() {
    return this._activePluginId.getValue();
  }

  /**
   * Opens an app in a sidecar. You can also pass some context object that will be then available to the app.
   * @experimental
   */
  openApp(pluginId: string, context?: unknown) {
    if (!this.assertFeatureEnabled()) {
      return;
    }
    if (this.localStorageKey) {
      localStorage.setItem(this.localStorageKey, pluginId);
    }

    this._activePluginId.next(pluginId);
    this._initialContext.next(context);
  }

  /**
   * @experimental
   */
  closeApp(pluginId: string) {
    if (!this.assertFeatureEnabled()) {
      return;
    }
    if (this._activePluginId.getValue() === pluginId) {
      if (this.localStorageKey) {
        localStorage.removeItem(this.localStorageKey);
      }
      this._activePluginId.next(undefined);
      this._initialContext.next(undefined);
    }
  }

  /**
   * This is mainly useful inside an app extensions which are executed outside of the main app context but can work
   * differently depending whether their app is currently rendered or not.
   * @experimental
   */
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

export const sidecarServiceSingleton_EXPERIMENTAL = new SidecarService_EXPERIMENTAL({
  localStorageKey: 'grafana.sidecar.activePluginId',
});

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
