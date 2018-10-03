import { ThunkAction } from 'redux-thunk';
import { StoreState } from '../../../types';
import { getBackendSrv } from '../../../core/services/backend_srv';
import { Invitee, OrgUser } from 'app/types';

export enum ActionTypes {
  LoadUsers = 'LOAD_USERS',
  LoadInvitees = 'LOAD_INVITEES',
  SetUsersSearchQuery = 'SET_USERS_SEARCH_QUERY',
}

export interface LoadUsersAction {
  type: ActionTypes.LoadUsers;
  payload: OrgUser[];
}

export interface LoadInviteesAction {
  type: ActionTypes.LoadInvitees;
  payload: Invitee[];
}

export interface SetUsersSearchQueryAction {
  type: ActionTypes.SetUsersSearchQuery;
  payload: string;
}

const usersLoaded = (users: OrgUser[]): LoadUsersAction => ({
  type: ActionTypes.LoadUsers,
  payload: users,
});

const inviteesLoaded = (invitees: Invitee[]): LoadInviteesAction => ({
  type: ActionTypes.LoadInvitees,
  payload: invitees,
});

export const setUsersSearchQuery = (query: string): SetUsersSearchQueryAction => ({
  type: ActionTypes.SetUsersSearchQuery,
  payload: query,
});

export type Action = LoadUsersAction | SetUsersSearchQueryAction | LoadInviteesAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action>;

export function loadUsers(): ThunkResult<void> {
  return async dispatch => {
    const users = await getBackendSrv().get('/api/org/users');
    dispatch(usersLoaded(users));
  };
}

export function loadInvitees(): ThunkResult<void> {
  return async dispatch => {
    const invitees = await getBackendSrv().get('/api/org/invites');
    dispatch(inviteesLoaded(invitees));
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
