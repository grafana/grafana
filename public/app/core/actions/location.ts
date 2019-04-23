import { LocationUpdate } from 'app/types';
import { actionCreatorFactory } from 'app/core/redux';

export const updateLocation = actionCreatorFactory<LocationUpdate>('UPDATE_LOCATION').create();
