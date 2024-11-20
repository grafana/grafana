import * as H from 'history';
import { pick } from 'lodash';
import { BehaviorSubject, map, Observable } from 'rxjs';

import { reportInteraction } from '../analytics/utils';
import { config } from '../config';

import { HistoryWrapper, LocationService, locationService } from './LocationService';

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
  private memoryLocationService: LocationService;
  private history: LocationStorageHistory;

  constructor() {
    this._initialContext = new BehaviorSubject<unknown | undefined>(undefined);
    // We need a local ref for this so we can tap into the location changes and drive rerendering of components based
    // on it without having a parent Router.
    this.history = createLocationStorageHistory({ storageKey: 'grafana.sidecar.history' });
    this.memoryLocationService = new HistoryWrapper(this.history);
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
    return this.history.getLocationObservable().pipe(
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
    return getPluginIdFromUrl(this.memoryLocationService.getLocation().pathname);
  }

  getLocationService() {
    return this.memoryLocationService;
  }

  /**
   * Opens an app in a sidecar. You can also pass some context object that will be then available to the app.
   * @deprecated
   * @experimental
   */
  openApp(pluginId: string, context?: unknown) {
    if (!this.assertFeatureEnabled()) {
      return;
    }
    this._initialContext.next(context);
    this.memoryLocationService.push({ pathname: `/a/${pluginId}` });

    reportInteraction('sidecar_service_open_app', { pluginId, version: 1 });
  }

  /**
   * Opens an app in a sidecar. You can also relative path inside the app to open.
   * @experimental
   */
  openAppV2(pluginId: string, path?: string) {
    if (!this.assertFeatureEnabled()) {
      return;
    }

    this.memoryLocationService.push({ pathname: `/a/${pluginId}${path || ''}` });
    reportInteraction('sidecar_service_open_app', { pluginId, version: 2 });
  }

  /**
   * @experimental
   */
  closeApp() {
    if (!this.assertFeatureEnabled()) {
      return;
    }

    this._initialContext.next(undefined);
    this.memoryLocationService.replace({ pathname: '/' });

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
  const { pathname } = locationService.getLocation();

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

type LocalStorageHistoryOptions = {
  storageKey: string;
};

interface LocationStorageHistory extends H.MemoryHistory {
  getLocationObservable(): Observable<H.Location | undefined>;
}

/**
 * Simple wrapper over the memory history that persists the location in the localStorage.
 *
 * @param options
 */
function createLocationStorageHistory(options: LocalStorageHistoryOptions): LocationStorageHistory {
  const storedLocation = localStorage.getItem(options.storageKey);
  const initialEntry = storedLocation ? JSON.parse(storedLocation) : '/';
  const locationSubject = new BehaviorSubject<H.Location | undefined>(initialEntry);
  const memoryHistory = H.createMemoryHistory({ initialEntries: [initialEntry] });

  let currentLocation = memoryHistory.location;

  function maybeUpdateLocation() {
    if (memoryHistory.location !== currentLocation) {
      localStorage.setItem(
        options.storageKey,
        JSON.stringify(pick(memoryHistory.location, 'pathname', 'search', 'hash'))
      );
      currentLocation = memoryHistory.location;
      locationSubject.next(memoryHistory.location);
    }
  }

  // This creates a sort of proxy over the memory location just to add the localStorage persistence and the location
  // observer. We could achieve the same effect by a listener but that would create a memory leak as there would be no
  // reasonable way to unsubcribe the listener later on.
  // Another issue is that react router for some reason does not care about proper `this` binding and just calls these
  // as normal functions. So if this were to be a class we would still need to bind each of these methods to the
  // instance so at that moment this just seems easier.
  return {
    ...memoryHistory,
    // Getter aren't destructured as getter but as values, so they have to be still here even though we are not
    // modifying them.
    get index() {
      return memoryHistory.index;
    },
    get entries() {
      return memoryHistory.entries;
    },
    get length() {
      return memoryHistory.length;
    },
    get action() {
      return memoryHistory.action;
    },
    get location() {
      return memoryHistory.location;
    },
    push(location: H.Path | H.LocationDescriptor<H.LocationState>, state?: H.LocationState) {
      memoryHistory.push(location, state);
      maybeUpdateLocation();
    },
    replace(location: H.Path | H.LocationDescriptor<H.LocationState>, state?: H.LocationState) {
      memoryHistory.replace(location, state);
      maybeUpdateLocation();
    },
    go(n: number) {
      memoryHistory.go(n);
      maybeUpdateLocation();
    },
    goBack() {
      memoryHistory.goBack();
      maybeUpdateLocation();
    },
    goForward() {
      memoryHistory.goForward();
      maybeUpdateLocation();
    },
    getLocationObservable() {
      return locationSubject.asObservable();
    },
  };
}

export const sidecarServiceSingleton_EXPERIMENTAL = new SidecarService_EXPERIMENTAL();
