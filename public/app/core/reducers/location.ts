import _ from 'lodash';
import { Action, createAction } from '@reduxjs/toolkit';
import { LocationUpdate } from '@grafana/runtime';

import { LocationState } from 'app/types';
import { renderUrl } from 'app/core/utils/url';

export const initialState: LocationState = {
  url: '',
  path: '',
  query: {},
  routeParams: {},
  replace: false,
  lastUpdated: 0,
};

export const updateLocation = createAction<LocationUpdate>('location/updateLocation');

export const locationReducer = (state: LocationState = initialState, action: Action<unknown>) => {
  if (updateLocation.match(action)) {
    const payload: LocationUpdate = action.payload;
    const { path, routeParams, replace } = payload;
    let query = payload.query || state.query;

    if (payload.partial) {
      query = _.defaults(query, state.query);
      query = _.omitBy(query, _.isNull);
    }

    return {
      url: renderUrl(path || state.path, query),
      path: path || state.path,
      query: { ...query },
      routeParams: routeParams || state.routeParams,
      replace: replace === true,
      lastUpdated: new Date().getTime(),
    };
  }

  return state;
};
