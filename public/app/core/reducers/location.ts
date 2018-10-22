import { Action } from 'app/core/actions/location';
import { LocationState } from 'app/types';
import { renderUrl } from 'app/core/utils/url';
import _ from 'lodash';

export const initialState: LocationState = {
  url: '',
  path: '',
  query: {},
  routeParams: {},
};

export const locationReducer = (state = initialState, action: Action): LocationState => {
  switch (action.type) {
    case 'UPDATE_LOCATION': {
      const { path, routeParams } = action.payload;
      let query = action.payload.query || state.query;

      if (action.payload.partial) {
        query = _.defaults(query, state.query);
      }

      return {
        url: renderUrl(path || state.path, query),
        path: path || state.path,
        query: query,
        routeParams: routeParams || state.routeParams,
      };
    }
  }

  return state;
};
