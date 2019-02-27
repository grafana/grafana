import { Action, CoreActionTypes } from 'app/core/actions/location';
import { LocationState } from 'app/types';
import { renderUrl } from 'app/core/utils/url';
import _ from 'lodash';

export const initialState: LocationState = {
  url: '',
  path: '',
  query: {},
  routeParams: {},
  replace: false,
  lastUpdated: 0,
};

export const locationReducer = (state = initialState, action: Action): LocationState => {
  switch (action.type) {
    case CoreActionTypes.UpdateLocation: {
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
    }
  }

  return state;
};
