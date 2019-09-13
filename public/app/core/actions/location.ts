import { LocationUpdate } from '@grafana/runtime';
import { actionCreatorFactory } from 'app/core/redux';

export const updateLocation = actionCreatorFactory<LocationUpdate>('UPDATE_LOCATION').create();

export interface LocationChanged {
  fromPath: string;
  toPath: string;
}

export const locationChanged = actionCreatorFactory<LocationChanged>('LOCATION_CHANGED').create();
