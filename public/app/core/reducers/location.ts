import { LocationState } from 'app/types';
import { renderUrl } from 'app/core/utils/url';
import _ from 'lodash';
import { reducerFactory } from 'app/core/redux';
import { updateLocation } from 'app/core/actions';

export const initialState: LocationState = {
  url: '',
  path: '',
  query: {},
  routeParams: {},
  replace: false,
  lastUpdated: 0,
};

export const locationReducer = reducerFactory<LocationState>(initialState)
  .addMapper({
    filter: updateLocation,
    mapper: (state, action): LocationState => {
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
  })
  .create();
