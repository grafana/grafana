import { Action } from 'redux';

import { Filter } from '../../../aggregations';
import { defaultFilter } from '../utils';

import { addFilter, changeFilter, removeFilter } from './actions';

export const reducer = (state: Filter[] = [], action: Action) => {
  if (addFilter.match(action)) {
    return [...state, defaultFilter()];
  }

  if (removeFilter.match(action)) {
    return state.slice(0, action.payload).concat(state.slice(action.payload + 1));
  }

  if (changeFilter.match(action)) {
    return state.map((filter, index) => {
      if (index !== action.payload.index) {
        return filter;
      }

      return action.payload.filter;
    });
  }

  return state;
};
