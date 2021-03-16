import { Action } from '../../../../../../hooks/useStatelessReducer';
import { Filter } from '../../../aggregations';

export const ADD_FILTER = '@bucketAggregations/filter/add';
export const REMOVE_FILTER = '@bucketAggregations/filter/remove';
export const CHANGE_FILTER = '@bucketAggregations/filter/change';

export type AddFilterAction = Action<typeof ADD_FILTER>;

export interface RemoveFilterAction extends Action<typeof REMOVE_FILTER> {
  payload: {
    index: number;
  };
}

export interface ChangeFilterAction extends Action<typeof CHANGE_FILTER> {
  payload: {
    index: number;
    filter: Filter;
  };
}
export type FilterAction = AddFilterAction | RemoveFilterAction | ChangeFilterAction;
