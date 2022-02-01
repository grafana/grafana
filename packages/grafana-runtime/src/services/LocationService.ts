import { UrlQueryMap } from '@grafana/data';
import * as H from 'history';
import { isUndefined } from 'lodash';
import { isTest } from 'src/utils/environment';
import { LocationUpdate } from './LocationSrv';

/**
 * @alpha
 * A wrapper to help work with browser location and history
 */
export interface LocationService {
  partial: (query: Record<string, any>, replace?: boolean) => void;
  push: (location: H.Path | H.LocationDescriptor<any>) => void;
  replace: (location: H.Path | H.LocationDescriptor<any>) => void;
  reload: () => void;
  getLocation: () => H.Location;
  getHistory: () => H.History;
  getSearch: () => URLSearchParams;
  getSearchObject: () => UrlQueryMap;

  /**
   * This is from the old LocationSrv interface
   * @deprecated use partial, push or replace instead */
  update: (update: LocationUpdate) => void;
}

/**
 * @alpha
 */
export let locationService: LocationService;

/** @internal
 * Used for tests only
 */
export const setLocationService = (instance: LocationService) => {
  if (isUndefined(locationService)) {
    locationService = instance;
    return;
  }

  if (isTest()) {
    locationService = instance;
    return;
  }

  throw new Error(`LocationService: should only be set once during Grafana application start.`);
};
