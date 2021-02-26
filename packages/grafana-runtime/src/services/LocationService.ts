import * as H from 'history';
import { LocationUpdate } from './LocationSrv';

export interface LocationService {
  partial: (query: Record<string, any>, replace?: boolean) => void;
  push: (location: H.Path | H.LocationDescriptor<any>) => void;
  replace: (location: H.Path) => void;
  getCurrentLocation: () => H.Location;
  getHistory: () => H.History;
  getSearch: () => URLSearchParams;

  /** @depecreated use partial, push or replace instead */
  update: (update: LocationUpdate) => void;
}

let singletonInstance: LocationService;

export function setLocationService(instance: LocationService) {
  singletonInstance = instance;
}

export function getLocationService(): LocationService {
  return singletonInstance;
}
