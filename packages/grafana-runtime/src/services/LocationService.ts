import { LocationDescriptorObject, History } from 'history';

export interface LocationService {
  getUrlSearchParams: () => URLSearchParams;
  partial: (query: Record<string, any>, replace?: boolean) => void;
  push: (location: LocationDescriptorObject) => void;
  replace: (location: LocationDescriptorObject) => void;
  getCurrentLocation: () => LocationDescriptorObject;
  getHistory: () => History;
}

let singletonInstance: LocationService;

export function setLocationService(instance: LocationService) {
  singletonInstance = instance;
}

export function getLocationService(): LocationService {
  return singletonInstance;
}
