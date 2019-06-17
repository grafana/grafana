import { OrgUser, ThunkResult } from 'app/types';
import { getBackendSrv } from '@grafana/runtime';
import { updateLocation } from 'app/core/actions';

export enum ActionTypes {
  LoadUser = 'LOAD_USER',
  SetUserName = 'SET_USER_NAME',
  SetUserEmail = 'SET_USER_EMAIL',
  SetUserLogin = 'SET_USER_LOGIN',
}

interface LoadUserAction {
  type: ActionTypes.LoadUser;
  payload: OrgUser;
}

interface SetUserNameAction {
  type: ActionTypes.SetUserName;
  payload: string;
}

interface SetUserEmailAction {
  type: ActionTypes.SetUserEmail;
  payload: string;
}

interface SetUserLoginAction {
  type: ActionTypes.SetUserLogin;
  payload: string;
}

const userLoaded = (user: OrgUser) => ({
  type: ActionTypes.LoadUser,
  payload: user,
});

export const setUserName = (name: string) => ({
  type: ActionTypes.SetUserName,
  payload: name,
});

export const setUserEmail = (email: string) => ({
  type: ActionTypes.SetUserEmail,
  payload: email,
});

export const setUserLogin = (login: string) => ({
  type: ActionTypes.SetUserLogin,
  payload: login,
});

export type Action = LoadUserAction | SetUserNameAction | SetUserEmailAction | SetUserLoginAction;

export function loadUser(id?: number): ThunkResult<any> {
  return async dispatch => {
    let userResponse;

    if (id) {
      userResponse = await getBackendSrv().get('/api/users/' + id);
    } else {
      userResponse = await getBackendSrv().get('/api/user');
    }

    dispatch(userLoaded(userResponse));
    return userResponse;
  };
}

export function updateUser(id?: number): ThunkResult<any> {
  return async (dispatch, getStore) => {
    const profile = getStore().user.profile;
    if (id) {
      await getBackendSrv().put('/api/users/' + id, profile);
      dispatch(updateLocation({ path: '/admin/users' }));
    } else {
      await getBackendSrv().put('/api/user/', profile);
      dispatch(loadUser());
    }
  };
}
