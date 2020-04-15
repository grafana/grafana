/**
 * Passed as options to the {@link LocationSrv} to describe how the automatically navigation
 * should be performed.
 *
 * @public
 */
import { UrlQueryMap } from '@grafana/data';

export interface LocationUpdate {
  /**
   * Target path where you automatically wants to navigate the user.
   */
  path?: string;

  /**
   * Specify this value if you want to add values to the query string of the URL.
   */
  query?: UrlQueryMap;

  /**
   * If set to true, the query argument will be added to the existing URL.
   */
  partial?: boolean;

  /**
   * Used internally to sync the Redux state from Angular to make sure that the Redux location
   * state is in sync when navigating using the Angular router.
   *
   * @remarks
   * Do not change this unless you are the Angular router.
   *
   * @internal
   */
  routeParams?: UrlQueryMap;

  /*
   * If set to true, this will replace URL state (ie. cause no new browser history).
   */
  replace?: boolean;
}

/**
 * If you need to automatically navigate the user to a new place in the application this should
 * be done via the LocationSrv and it will make sure to update the application state accordingly.
 *
 * @public
 */
export interface LocationSrv {
  update(options: LocationUpdate): void;
}

let singletonInstance: LocationSrv;

/**
 * Used during startup by Grafana to set the LocationSrv so it is available
 * via the the {@link getLocationSrv} to the rest of the application.
 *
 * @internal
 */
export function setLocationSrv(instance: LocationSrv) {
  singletonInstance = instance;
}

/**
 * Used to retrieve the {@link LocationSrv} that can be used to automatically navigate
 * the user to a new place in Grafana.
 *
 * @public
 */
export function getLocationSrv(): LocationSrv {
  return singletonInstance;
}
