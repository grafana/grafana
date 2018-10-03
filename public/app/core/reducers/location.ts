import { Action } from 'app/core/actions/location';
import { LocationState } from 'app/types';
import { renderUrl } from 'app/core/utils/url';

export const initialState: LocationState = {
  url: '',
  path: '',
  query: {},
  routeParams: {},
};

export const locationReducer = (state = initialState, action: Action): LocationState => {
  switch (action.type) {
    case 'UPDATE_LOCATION': {
      const { path, query, routeParams } = action.payload;
      return {
        url: renderUrl(path || state.path, query),
        path: path || state.path,
        query: query || state.query,
        routeParams: routeParams || state.routeParams,
      };
    }
  }

  return state;
};
