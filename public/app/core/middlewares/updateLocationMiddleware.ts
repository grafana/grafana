import { Store, Dispatch } from 'redux';
import { StoreState } from '../../types';
import { ActionOf } from '../redux';
import { updateLocation } from '../actions';
import { LocationUpdate } from '@grafana/runtime';
import { locationChanged } from '../actions/location';

export const updateLocationMiddleware = (store: Store<StoreState>) => (next: Dispatch) => (action: ActionOf<any>) => {
  const isUpdateLocationAction = action.type === updateLocation.type;
  if (!isUpdateLocationAction) {
    next(action);
    return;
  }

  // Fetch these values before we call the first next, after that state will be updated
  const state = store.getState().location;
  const { path } = action.payload as LocationUpdate;

  next(action);

  if (path !== state.path) {
    next(locationChanged({ fromPath: state.path, toPath: path }));
  }
};
