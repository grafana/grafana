import { Filter } from '../../../state/types';
import { FilterAction, ADD_FILTER, REMOVE_FILTER, CHANGE_FILTER } from './types';

export const addFilter = (): FilterAction => ({
  type: ADD_FILTER,
});

export const removeFilter = (index: number): FilterAction => ({
  type: REMOVE_FILTER,
  payload: { index },
});

export const changeFilter = (index: number, filter: Filter): FilterAction => ({
  type: CHANGE_FILTER,
  payload: { index, filter },
});
