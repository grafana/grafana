import { LocationUpdate } from 'app/types';

export enum CoreActionTypes {
  UpdateLocation = 'UPDATE_LOCATION',
}

export type Action = UpdateLocationAction;

export interface UpdateLocationAction {
  type: CoreActionTypes.UpdateLocation;
  payload: LocationUpdate;
}

export const updateLocation = (location: LocationUpdate): UpdateLocationAction => ({
  type: CoreActionTypes.UpdateLocation,
  payload: location,
});
