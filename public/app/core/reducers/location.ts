import _ from 'lodash';
import { Action, createAction } from '@reduxjs/toolkit';
import { LocationUpdate } from '@grafana/runtime';

import { LocationState, ThunkResult } from 'app/types';
import { urlUtil } from '@grafana/data';
import { navigationLogger, parseValue } from '../navigation/utils';

export const initialState: LocationState = {
  url: '',
  path: '',
  query: {},
  routeParams: {},
  replace: false,
  lastUpdated: 0,
};

export const updateLocationInState = createAction<LocationUpdate>('location/updateLocation');

export function updateLocation(payload: LocationUpdate): ThunkResult<void> {
  return async function (dispatch) {
    const forceLoginParam = payload.query?.forceLogin;
    if (forceLoginParam !== null && parseValue(forceLoginParam as string)) {
      navigationLogger('AppWrapper', false, 'Force login', payload);
      window.location.href = `${payload.path}?${urlUtil.toUrlParams({ ...payload.query, forceLogin: 'true' })}`;
      return;
    }

    dispatch(updateLocationInState(payload));
  };
}
// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because Angular would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export const locationReducer = (state: LocationState = initialState, action: Action<unknown>) => {
  if (updateLocationInState.match(action)) {
    const payload: LocationUpdate = action.payload;
    const { path, routeParams, replace } = payload;
    let query = payload.query || state.query;

    if (payload.partial) {
      query = _.defaults(query, state.query);
      query = _.omitBy(query, _.isNull);
    }

    return {
      url: urlUtil.renderUrl(path || state.path, query),
      path: path || state.path,
      query: { ...query },
      routeParams: routeParams || state.routeParams,
      replace: replace === true,
      lastUpdated: new Date().getTime(),
    };
  }

  return state;
};
