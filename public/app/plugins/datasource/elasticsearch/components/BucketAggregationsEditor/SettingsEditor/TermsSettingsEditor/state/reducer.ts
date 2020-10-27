import { Filter } from '../../../state/types';
import { defaultFilter } from '../utils';
import { ADD_FILTER, CHANGE_FILTER, FilterAction, REMOVE_FILTER } from './types';

export const reducer = (state: Filter[], action: FilterAction) => {
  switch (action.type) {
    case ADD_FILTER:
      return [...state, defaultFilter()];
    case REMOVE_FILTER:
      return state.slice(0, action.payload.index).concat(state.slice(action.payload.index + 1));

    case CHANGE_FILTER:
      return state.map((filter, index) => {
        if (index !== action.payload.index) {
          return filter;
        }

        return action.payload.filter;
      });
  }
};
