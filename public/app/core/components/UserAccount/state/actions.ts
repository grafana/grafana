import { OrgUser, ThunkResult } from 'app/types';
import { getBackendSrv } from '@grafana/runtime';

export enum ActionTypes {
  LoadUserProfile = 'LOAD_USER_PROFILE',
  SetUserName = 'SET_USER_NAME',
  SetUserEmail = 'SET_USER_EMAIL',
  SetUserLogin = 'SET_USER_LOGIN',
  SetIsAdmin = 'SET_IS_ADMIN',
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

interface SetIsAdminAction {
  type: ActionTypes.SetIsAdmin;
  payload: boolean;
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

export const setIsAdmin = (isAdmin: boolean) => ({
  type: ActionTypes.SetIsAdmin,
  payload: isAdmin,
});

export type Action =
  | LoadUserProfileAction
  | SetUserNameAction
  | SetUserEmailAction
  | SetUserLoginAction
  | SetIsAdminAction;

export function loadUserProfile(): ThunkResult<any> {
  return async dispatch => {
    const userProfileResponse = await getBackendSrv().get('/api/user');
    dispatch(userProfileLoaded(userProfileResponse));
    return userProfileResponse;
  };
}

export function updateUserProfile(): ThunkResult<any> {
  return async (dispatch, getStore) => {
    const userProfile = getStore().user.userProfile;

    await getBackendSrv().put('/api/user/', userProfile);

    dispatch(loadUserProfile());
  };
}
