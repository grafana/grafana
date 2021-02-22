import * as H from 'history';

export interface LocationService {
  getUrlSearchParams: () => URLSearchParams;
  partial: (query: Record<string, any>, replace?: boolean) => void;
  push: (location: H.To) => void;
  replace: (location: H.To) => void;
  getCurrentLocation: () => H.Location;
  pushPath: (path: H.Path) => void;
  replacePath: (path: H.Path) => void;
  getHistory: () => H.History;
}

let singletonInstance: LocationService;

export function setLocationService(instance: LocationService) {
  singletonInstance = instance;
}

export function getLocationService(): LocationService {
  return singletonInstance;
}
