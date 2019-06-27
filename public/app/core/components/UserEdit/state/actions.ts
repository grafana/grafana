import { getBackendSrv } from '@grafana/runtime';
import { OrgUser, ThunkResult } from 'app/types';

export enum ActionTypes {
  LoadUser = 'LOAD_USER',
}

interface LoadUserAction {
  type: ActionTypes.LoadUser;
  payload: OrgUser;
}

const userLoaded = (user: OrgUser) => ({
  type: ActionTypes.LoadUser,
  payload: user,
});

export type Action = LoadUserAction;

export function loadUser(id?: number): ThunkResult<any> {
  return async dispatch => {
    let userResponse;

    if (id) {
      userResponse = await getBackendSrv().get('/api/users/' + id);
    } else {
      userResponse = await getBackendSrv().get('/api/user');
    }

    dispatch(userLoaded(userResponse));
  };
}

export function clearUser(): ThunkResult<any> {
  return async dispatch => {
    const userResponse = {} as OrgUser;
    dispatch(userLoaded(userResponse));
    return userResponse;
  };
}

export function updateUser(updates: object, id?: number): ThunkResult<any> {
  return async dispatch => {
    if (id) {
      await getBackendSrv().put('/api/users/' + id, updates);
    } else {
      await getBackendSrv().put('/api/user/', updates);
    }
    dispatch(loadUser(id));
  };
}

export function updateUserPermissions(permissions: object, id: number): ThunkResult<any> {
  return async dispatch => {
    await getBackendSrv().put('/api/admin/users/' + id + '/permissions', permissions);
  };
}

export function toggleUserStatus(disabled: boolean, id: number): ThunkResult<any> {
  return async dispatch => {
    const actionEndpoint = disabled ? '/enable' : '/disable';
    await getBackendSrv().post('/api/admin/users/' + id + actionEndpoint, {});
    dispatch(loadUser(id));
  };
}
