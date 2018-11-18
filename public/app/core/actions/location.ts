import { LocationUpdate } from 'app/types';

export type Action = UpdateLocationAction;

export interface UpdateLocationAction {
  type: 'UPDATE_LOCATION';
  payload: LocationUpdate;
}

export const updateLocation = (location: LocationUpdate): UpdateLocationAction => ({
  type: 'UPDATE_LOCATION',
  payload: location,
});
