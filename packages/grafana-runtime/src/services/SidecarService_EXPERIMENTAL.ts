import { BehaviorSubject, map } from 'rxjs';

import { reportInteraction } from '../analytics/utils';
import { config } from '../config';

import { createLocationStorageHistory } from './LocalStorageMemoryHistory';
import {
  HistoryWrapper,
  locationService as mainLocationService,
  LocationService,
  locationServiceSecondary,
} from './LocationService';

// Only allow sidecar to be opened on these routes. It does not seem to make sense to keep the sidecar opened on
// config/admin pages for example.
// At this moment let's be restrictive about where the sidecar can show and add more routes if there is a need.
const ALLOW_ROUTES = [
  /(^\/d\/)/, // dashboards
  /^\/explore/, // explore + explore metrics
  /^\/a\/[^\/]+/, // app plugins
  /^\/alerting/,
];

/**
 * This is a service that handles state and operation of a sidecar feature (sideview to render a second app in grafana).
 * At this moment this is highly experimental and if used should be understood to break easily with newer versions.
 * None of this functionality works without a feature toggle `appSidecar` being enabled.
 *
 * Right now this being in a single service is more of a practical tradeoff for easier isolation in the future these
 * APIs may be integrated into other services or features like app extensions, plugin system etc.
 *
 * @experimental
 */
export class SidecarService_EXPERIMENTAL {
  private _initialContext: BehaviorSubject<unknown | undefined>;

  private secondaryMemoryLocationService: LocationService;
  private mainLocationService: LocationService;
  private secondaryLocationService: LocationService;

  // If true we don't close the sidecar when user navigates to another app or part of Grafana from where the sidecar
  // was opened.
  private follow = false;
  private memory = false;

  // Keep track of where the sidecar was originally opened for autoclose behaviour.
  private mainLocationWhenOpened: string | undefined;

  private mainOnAllowedRoute = false;

  constructor(options: { mainLocationService: LocationService; secondaryLocationService: LocationService }) {
    this._initialContext = new BehaviorSubject<unknown | undefined>(undefined);
    this.mainLocationService = options.mainLocationService;
    this.secondaryLocationService = options.secondaryLocationService;
    this.secondaryMemoryLocationService = new HistoryWrapper(
      createLocationStorageHistory({ storageKey: 'grafana.sidecar.history' })
    );
    this.handleMainLocationChanges();
  }

  private assertFeatureEnabled() {
    if (!config.featureToggles.appSidecar) {
      console.warn('The `appSidecar` feature toggle is not enabled, doing nothing.');
      return false;
    }

    return true;
  }

  private updateMainLocationWhenOpened() {
    const pathname = this.mainLocationService.getLocation().pathname;
    for (const route of ALLOW_ROUTES) {
      const match = pathname.match(route)?.[0];
      if (match) {
        this.mainLocationWhenOpened = match;
        return;
      }
    }
  }

  /**
   * Every time the main location changes we check if we should keep the sidecar open or close it based on list
   * of allowed routes and also based on the follow flag when opening the app.
   */
  private handleMainLocationChanges() {
    this.mainOnAllowedRoute = ALLOW_ROUTES.some((prefix) =>
      this.mainLocationService.getLocation().pathname.match(prefix)
    );

    // This is run during construction so we initialize stuff based on current state of the URL.
    if (!this.mainOnAllowedRoute) {
      this.closeApp();
    } else if (this.activePluginId) {
      this.mainLocationWhenOpened = this.mainLocationService.getLocation().pathname;
    }

    this.mainLocationService.getLocationObservable().subscribe((location) => {
      if (!this.activePluginId) {
        return;
      }
      this.mainOnAllowedRoute = ALLOW_ROUTES.some((prefix) => location.pathname.match(prefix));

      if (!this.mainOnAllowedRoute) {
        this.closeApp();
        return;
      }

      // We check if we moved to some other app or part of grafana from where we opened the sidecar.
      const isTheSameLocation = Boolean(
        this.mainLocationWhenOpened && location.pathname.startsWith(this.mainLocationWhenOpened)
      );

      if (!(isTheSameLocation || this.follow)) {
        this.closeApp();
      }
    });
  }

  /**
   * Get current app id of the app in sidecar. This is most probably provisional. In the future
   * this should be driven by URL addressing so that routing for the apps don't change. Useful just internally
   * to decide which app to render.
   *
   * @experimental
   */
  get activePluginIdObservable() {
    return this.getLocationService()
      .getLocationObservable()
      .pipe(
        map((val) => {
          return getPluginIdFromUrl(val?.pathname || '');
        })
      );
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
    return getPluginIdFromUrl(this.getLocationService().getLocation().pathname);
  }

  getLocationService() {
    if (this.memory) {
      return this.secondaryMemoryLocationService;
    } else {
      return this.secondaryLocationService;
    }
  }

  /**
   * Opens an app in a sidecar. You can also pass some context object that will be then available to the app.
   * @deprecated
   * @experimental
   */
  openApp(pluginId: string, context?: unknown) {
    if (!(this.assertFeatureEnabled() && this.mainOnAllowedRoute)) {
      return;
    }
    this._initialContext.next(context);
    this.openAppV3({ pluginId, follow: false });
  }

  /**
   * Opens an app in a sidecar. You can also relative path inside the app to open.
   * @deprecated
   * @experimental
   */
  openAppV2(pluginId: string, path?: string) {
    this.openAppV3({ pluginId, path, follow: false });
  }

  /**
   * Opens an app in a sidecar. You can also relative path inside the app to open.
   * @param options.pluginId Plugin ID of the app to open
   * @param options.path Relative path inside the app to open
   * @param options.follow If true, the sidecar will stay open even if the main location change to another app or
   *   Grafana section
   *
   * @experimental
   */
  openAppV3(options: { pluginId: string; path?: string; follow?: boolean; memory?: boolean }) {
    if (!(this.assertFeatureEnabled() && this.mainOnAllowedRoute)) {
      return;
    }

    this.follow = options.follow || false;

    // TODO: probably also clear state in locationService we used before
    this.memory = options.memory || false;

    this.updateMainLocationWhenOpened();
    this.getLocationService().push({ pathname: `/a/${options.pluginId}${options.path || ''}` });
    reportInteraction('sidecar_service_open_app', { pluginId: options.pluginId, follow: options.follow });
  }

  /**
   * @experimental
   */
  closeApp() {
    if (!this.assertFeatureEnabled()) {
      return;
    }

    this.follow = false;
    this.mainLocationWhenOpened = undefined;
    this._initialContext.next(undefined);

    // Do both just to be sure some state does not linger
    this.secondaryMemoryLocationService.replace({ pathname: undefined });
    this.secondaryLocationService.replace({ pathname: undefined });

    reportInteraction('sidecar_service_close_app');
  }

  /**
   * This is mainly useful inside an app extensions which are executed outside the main app context but can work
   * differently depending on whether their app is currently rendered or not.
   *
   * This is also true only in case a sidecar is opened. In other cases, just to check if a single app is opened
   * probably does not make sense.
   *
   * This means these are the states and the result of this function:
   * Single app is opened: false (may seem strange from considering the function name, but the main point of
   *   this is to recognize when the app needs to do specific alteration in context of running next to second app)
   * 2 apps are opened and pluginId is the one in the main window: true
   * 2 apps are opened and pluginId is the one in the sidecar window: true
   * 2 apps are opened and pluginId is not one of those: false
   *
   * @experimental
   */
  isAppOpened(pluginId: string) {
    if (!this.assertFeatureEnabled()) {
      return false;
    }

    const result = !!(this.activePluginId && (this.activePluginId === pluginId || getMainAppPluginId() === pluginId));
    reportInteraction('sidecar_service_is_app_opened', { pluginId, isOpened: result });
    return result;
  }
}

const pluginIdUrlRegex = /a\/([^\/]+)/;
function getPluginIdFromUrl(url: string) {
  return url.match(pluginIdUrlRegex)?.[1];
}

// The app plugin that is "open" in the main Grafana view
function getMainAppPluginId() {
  // TODO: not great but we have to get a handle on the other locationService used for the main view and easiest way
  //   right now is through this global singleton
  const { pathname } = mainLocationService.getLocation();

  // A naive way to sort of simulate core features being an app and having an appID
  let mainApp = getPluginIdFromUrl(pathname);
  if (!mainApp && pathname.match(/\/explore/)) {
    mainApp = 'explore';
  }

  if (!mainApp && pathname.match(/\/d\//)) {
    mainApp = 'dashboards';
  }

  return mainApp || 'unknown';
}

export const sidecarServiceSingleton_EXPERIMENTAL = new SidecarService_EXPERIMENTAL({
  mainLocationService: mainLocationService,
  secondaryLocationService: locationServiceSecondary,
});
