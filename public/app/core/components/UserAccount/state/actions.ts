import { OrgUser, ThunkResult } from 'app/types';
import { getBackendSrv } from '@grafana/runtime';
import { updateLocation } from 'app/core/actions';

export enum ActionTypes {
  LoadUserProfile = 'LOAD_USER_PROFILE',
  SetUserName = 'SET_USER_NAME',
  SetUserEmail = 'SET_USER_EMAIL',
  SetUserLogin = 'SET_USER_LOGIN',
}

interface LoadUserProfileAction {
  type: ActionTypes.LoadUserProfile;
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

const userProfileLoaded = (userProfile: OrgUser) => ({
  type: ActionTypes.LoadUserProfile,
  payload: userProfile,
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

export type Action = LoadUserProfileAction | SetUserNameAction | SetUserEmailAction | SetUserLoginAction;

export function loadUserProfile(id?: number): ThunkResult<any> {
  return async dispatch => {
    let userProfileResponse;

    if (id) {
      userProfileResponse = await getBackendSrv().get('/api/users/' + id);
    } else {
      userProfileResponse = await getBackendSrv().get('/api/user');
    }

    dispatch(userProfileLoaded(userProfileResponse));
    return userProfileResponse;
  };
}

export function updateUserProfile(id?: number): ThunkResult<any> {
  return async (dispatch, getStore) => {
    const userProfile = getStore().userAccount.userProfile;
    if (id) {
      await getBackendSrv().put('/api/users/' + id, userProfile);
      dispatch(updateLocation({ path: '/admin/users' }));
    } else {
      await getBackendSrv().put('/api/user/', userProfile);
      dispatch(loadUserProfile());
    }
  };
}
