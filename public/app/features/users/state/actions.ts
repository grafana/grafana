import { ThunkAction } from 'redux-thunk';
import { StoreState } from '../../../types';
import { getBackendSrv } from '../../../core/services/backend_srv';
import { User } from 'app/types';

export enum ActionTypes {
  LoadUsers = 'LOAD_USERS',
  SetUsersSearchQuery = 'SET_USERS_SEARCH_QUERY',
}

export interface LoadUsersAction {
  type: ActionTypes.LoadUsers;
  payload: User[];
}

export interface SetUsersSearchQueryAction {
  type: ActionTypes.SetUsersSearchQuery;
  payload: string;
}

const usersLoaded = (users: User[]): LoadUsersAction => ({
  type: ActionTypes.LoadUsers,
  payload: users,
});

export const setUsersSearchQuery = (query: string): SetUsersSearchQueryAction => ({
  type: ActionTypes.SetUsersSearchQuery,
  payload: query,
});

export type Action = LoadUsersAction | SetUsersSearchQueryAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action>;

export function loadUsers(): ThunkResult<void> {
  return async dispatch => {
    const users = await getBackendSrv().get('/api/org/users');
    dispatch(usersLoaded(users));
  };
}
