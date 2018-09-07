import { NavModelItem } from '../../types';

export enum ActionTypes {
  UpdateNavIndex = 'UPDATE_NAV_INDEX',
}

export type Action = UpdateNavIndexAction;

// this action is not used yet
// kind of just a placeholder, will be need for dynamic pages
// like datasource edit, teams edit page

export interface UpdateNavIndexAction {
  type: ActionTypes.UpdateNavIndex;
  payload: NavModelItem;
}

export const updateNavIndex = (item: NavModelItem): UpdateNavIndexAction => ({
  type: ActionTypes.UpdateNavIndex,
  payload: item,
});
