import { LocationUpdate } from 'app/types';
import { getPlaylistSrv } from 'app/features/playlist/playlist_srv';

export enum CoreActionTypes {
  UpdateLocation = 'UPDATE_LOCATION',
}

export type Action = UpdateLocationAction;

export interface UpdateLocationAction {
  type: CoreActionTypes.UpdateLocation;
  payload: LocationUpdate;
}

export const updateLocation = (location: LocationUpdate) => (dispatch, getState) => {
  const playlistSrv = getPlaylistSrv();

  if (playlistSrv && playlistSrv.isPlaying) {
    playlistSrv.handleLocationUpdate(getState().location, location);
  }

  dispatch({
    type: CoreActionTypes.UpdateLocation,
    payload: location,
  });
};
