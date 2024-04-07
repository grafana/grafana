import { config } from '@grafana/runtime';

import { ThunkResult, UserOrg } from '../../../types';
import { api } from '../api';
import { ChangePasswordFields, ProfileUpdateFields } from '../types';

import {
//initLoadOrgs, // LOGZ.IO CHANGES
//initLoadSessions, // LOGZ.IO CHANGES
//initLoadTeams, // LOGZ.IO CHANGES
//orgsLoaded, // LOGZ.IO CHANGES
//sessionsLoaded, // LOGZ.IO CHANGES
  setUpdating,
//teamsLoaded, // LOGZ.IO CHANGES
  userLoaded,
  userSessionRevoked,
} from './reducers';

export function changePassword(payload: ChangePasswordFields): ThunkResult<void> {
  return async function (dispatch) {
    dispatch(setUpdating({ updating: true }));
    await api.changePassword(payload);
    dispatch(setUpdating({ updating: false }));
  };
}

export function initUserProfilePage(): ThunkResult<void> {
  return async function (dispatch) {
    await dispatch(loadUser());
    // dispatch(loadTeams()); // LOGZ.IO CHANGES
    // dispatch(loadOrgs()); // LOGZ.IO CHANGES
    // dispatch(loadSessions()); // LOGZ.IO CHANGES
  };
}

export function loadUser(): ThunkResult<void> {
  return async function (dispatch) {
    const user = await api.loadUser();
    dispatch(userLoaded({ user }));
  };
}

/* LOGZ.IO CHANGES :: start
function loadTeams(): ThunkResult<void> {
  return async function (dispatch) {
    dispatch(initLoadTeams());
    const teams = await api.loadTeams();
    dispatch(teamsLoaded({ teams }));
  };
}

function loadOrgs(): ThunkResult<void> {
  return async function (dispatch) {
    dispatch(initLoadOrgs());
    const orgs = await api.loadOrgs();
    dispatch(orgsLoaded({ orgs }));
  };
}

function loadSessions(): ThunkResult<void> {
  return async function (dispatch) {
    dispatch(initLoadSessions());
    const sessions = await api.loadSessions();
    dispatch(sessionsLoaded({ sessions }));
  };
}
// LOGZ.IO CHANGES :: end */

export function revokeUserSession(tokenId: number): ThunkResult<void> {
  return async function (dispatch) {
    dispatch(setUpdating({ updating: true }));
    await api.revokeUserSession(tokenId);
    dispatch(userSessionRevoked({ tokenId }));
  };
}

export function changeUserOrg(org: UserOrg): ThunkResult<void> {
  return async function (dispatch) {
    dispatch(setUpdating({ updating: true }));
    await api.setUserOrg(org);
    window.location.href = config.appSubUrl + '/profile';
  };
}

export function updateUserProfile(payload: ProfileUpdateFields): ThunkResult<void> {
  return async function (dispatch) {
    dispatch(setUpdating({ updating: true }));
    await api.updateUserProfile(payload);
    await dispatch(loadUser());
    dispatch(setUpdating({ updating: false }));
  };
}
