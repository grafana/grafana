import _ from 'lodash';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
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

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    updateLocation: (state, action: PayloadAction<LocationUpdate>) => {
      const { path, routeParams, replace } = action.payload;
      let query = action.payload.query || state.query;

      if (action.payload.partial) {
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
    },
  },
});

export const { updateLocation } = locationSlice.actions;

export const locationReducer = locationSlice.reducer;
