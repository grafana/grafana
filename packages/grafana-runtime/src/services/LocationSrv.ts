export interface LocationUpdate {
  path?: string;
  query?: UrlQueryMap;

  /**
   * Add the query argument to the existing URL
   */
  partial?: boolean;

  /**
   * Do not change this unless you are the angular router
   */
  routeParams?: UrlQueryMap;

  /*
   * If true this will replace url state (ie cause no new browser history)
   */
  replace?: boolean;
}

export type UrlQueryValue = string | number | boolean | string[] | number[] | boolean[] | undefined | null;
export type UrlQueryMap = Record<string, UrlQueryValue>;

export interface LocationSrv {
  update(options: LocationUpdate): void;
}

let singletonInstance: LocationSrv;

export function setLocationSrv(instance: LocationSrv) {
  singletonInstance = instance;
}

export function getLocationSrv(): LocationSrv {
  return singletonInstance;
}
