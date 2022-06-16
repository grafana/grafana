import { getBackendSrv } from '@grafana/runtime';
import { accessControlQueryParam } from 'app/core/utils/accessControl';
import { OrgUser } from 'app/types';

import { ThunkResult } from '../../../types';

import { usersLoaded } from './reducers';

export function loadUsers(): ThunkResult<void> {
  return async (dispatch) => {
    const users = await getBackendSrv().get('/api/org/users', accessControlQueryParam());
    dispatch(usersLoaded(users));
  };
}

export function updateUser(user: OrgUser): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().patch(`/api/org/users/${user.userId}`, { role: user.role });
    dispatch(loadUsers());
  };
}

export function removeUser(userId: number): ThunkResult<void> {
  return async (dispatch) => {
    await getBackendSrv().delete(`/api/org/users/${userId}`);
    dispatch(loadUsers());
  };
}
