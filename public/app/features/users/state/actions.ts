import { ThunkAction } from 'redux-thunk';
import { StoreState } from '../../../types';
import { getBackendSrv } from '@grafana/runtime';
import { Invitee, OrgUser } from 'app/types';
import { actionCreatorFactory, ActionOf } from '../../../core/redux';

export interface LoadUsersAction {
  users: OrgUser[];
}

export interface LoadInviteesAction {
  invitees: Invitee[];
}

export interface SetUsersSearchQueryAction {
  query: string;
}

export const usersLoaded = actionCreatorFactory<LoadUsersAction>('LOAD_USERS').create();
export const inviteesLoaded = actionCreatorFactory<LoadInviteesAction>('LOAD_INVITEES').create();
export const setUsersSearchQuery = actionCreatorFactory<SetUsersSearchQueryAction>('SET_USERS_SEARCH_QUERY').create();

export type Action = LoadUsersAction | SetUsersSearchQueryAction | LoadInviteesAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, ActionOf<any>>;

export function loadUsers(): ThunkResult<void> {
  return async dispatch => {
    const users: OrgUser[] = await getBackendSrv().get('/api/org/users');
    dispatch(usersLoaded({ users }));
  };
}

export function loadInvitees(): ThunkResult<void> {
  return async dispatch => {
    const invitees: Invitee[] = await getBackendSrv().get('/api/org/invites');
    dispatch(inviteesLoaded({ invitees }));
  };
}

export function updateUser(user: OrgUser): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().patch(`/api/org/users/${user.userId}`, { role: user.role });
    dispatch(loadUsers());
  };
}

export function removeUser(userId: number): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().delete(`/api/org/users/${userId}`);
    dispatch(loadUsers());
  };
}

export function revokeInvite(code: string): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().patch(`/api/org/invites/${code}/revoke`, {});
    dispatch(loadInvitees());
  };
}
