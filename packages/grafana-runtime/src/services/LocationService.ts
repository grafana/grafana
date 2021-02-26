import { ILocationService } from 'angular';
import * as H from 'history';
import { LocationUpdate } from './LocationSrv';

// Backwards compatibility for Angulars's $location service, picked methods are the ones we actually use
interface AngularLocationProviderAPI extends Pick<ILocationService, 'path' | 'hash' | 'url' | 'search'> {}

export interface LocationService extends AngularLocationProviderAPI {
  partial: (query: Record<string, any>, replace?: boolean) => void;
  push: (location: H.Path | H.LocationDescriptor<any>) => void;
  replace: (location: H.Path) => void;
  getCurrentLocation: () => H.Location;
  getHistory: () => H.History;

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
