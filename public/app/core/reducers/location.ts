import _ from 'lodash';
import { Action, createAction } from '@reduxjs/toolkit';
import { LocationUpdate, UrlQueryMap } from '@grafana/runtime';

import { LocationState, CoreEvents } from 'app/types';
import { renderUrl } from 'app/core/utils/url';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

export const initialState: LocationState = {
  url: '',
  path: '',
  query: {},
  routeParams: {},
  replace: false,
  lastUpdated: 0,
};

export const updateLocation = createAction<LocationUpdate>('location/updateLocation');

// Redux Toolkit uses ImmerJs as part of their solution to ensure that state objects are not mutated.
// ImmerJs has an autoFreeze option that freezes objects from change which means this reducer can't be migrated to createSlice
// because the state would become frozen and during run time we would get errors because Angular would try to mutate
// the frozen state.
// https://github.com/reduxjs/redux-toolkit/issues/242
export const locationReducer = (state: LocationState = initialState, action: Action<unknown>) => {
  if (updateLocation.match(action)) {
    const payload: LocationUpdate = action.payload;
    const { path, routeParams, replace } = payload;
    let query = payload.query || state.query;

    if (payload.partial) {
      query = _.defaults(query, state.query);
    }

    // Find all the vars that changed
    const changed = Object.keys(query).filter(k => {
      return k.startsWith('var-') && query[k] !== state.query[k];
    });
    if (changed) {
      const dash = getDashboardSrv().getCurrent();
      if (dash) {
        const vars: UrlQueryMap = {};
        for (const k of changed) {
          vars[k] = query[k];
        }
        dash.events.emit(CoreEvents.templateVarsChangedInUrl, vars);
      }
    }

    if (payload.partial) {
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
