import { ThunkResult } from '../../../types';
import { getBackendSrv } from '@grafana/runtime';
import { OrgUser } from 'app/types';
import { inviteesLoaded, usersLoaded } from './reducers';

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
