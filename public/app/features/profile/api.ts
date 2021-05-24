import { getBackendSrv } from '@grafana/runtime';

import { ChangePasswordFields, ProfileUpdateFields } from './types';
import { Team, UserDTO, UserOrg, UserSession } from '../../types';

async function changePassword(payload: ChangePasswordFields): Promise<void> {
  try {
    await getBackendSrv().put('/api/user/password', payload);
  } catch (err) {
    console.error(err);
  }
}

async function loadUser(): Promise<UserDTO> {
  return await getBackendSrv().get('/api/user');
}

async function loadTeams(): Promise<Team[]> {
  return await getBackendSrv().get('/api/user/teams');
}

async function loadOrgs(): Promise<UserOrg[]> {
  return await getBackendSrv().get('/api/user/orgs');
}

async function loadSessions(): Promise<UserSession[]> {
  return await getBackendSrv().get('/api/user/auth-tokens');
}

async function revokeUserSession(tokenId: number): Promise<void> {
  await getBackendSrv().post('/api/user/revoke-auth-token', {
    authTokenId: tokenId,
  });
}

async function setUserOrg(org: UserOrg): Promise<void> {
  await getBackendSrv().post('/api/user/using/' + org.orgId, {});
}

async function updateUserProfile(payload: ProfileUpdateFields): Promise<void> {
  try {
    await getBackendSrv().put('/api/user', payload);
  } catch (err) {
    console.error(err);
  }
}

export const api = {
  changePassword,
  revokeUserSession,
  loadUser,
  loadSessions,
  loadOrgs,
  loadTeams,
  setUserOrg,
  updateUserProfile,
};
