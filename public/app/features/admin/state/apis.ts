import { getBackendSrv } from '@grafana/runtime';
import { dateTime } from '@grafana/data';
import { LdapUser, LdapConnectionInfo, UserSession, SyncInfo, User } from 'app/types';

export interface ServerStat {
  name: string;
  value: number;
}

export const getServerStats = async (): Promise<ServerStat[]> => {
  try {
    const res = await getBackendSrv().get('api/admin/stats');
    return [
      { name: 'Total users', value: res.users },
      { name: 'Total admins', value: res.admins },
      { name: 'Total editors', value: res.editors },
      { name: 'Total viewers', value: res.viewers },
      { name: 'Active users (seen last 30 days)', value: res.activeUsers },
      { name: 'Active admins (seen last 30 days)', value: res.activeAdmins },
      { name: 'Active editors (seen last 30 days)', value: res.activeEditors },
      { name: 'Active viewers (seen last 30 days)', value: res.activeViewers },
      { name: 'Active sessions', value: res.activeSessions },
      { name: 'Total dashboards', value: res.dashboards },
      { name: 'Total orgs', value: res.orgs },
      { name: 'Total playlists', value: res.playlists },
      { name: 'Total snapshots', value: res.snapshots },
      { name: 'Total dashboard tags', value: res.tags },
      { name: 'Total starred dashboards', value: res.stars },
      { name: 'Total alerts', value: res.alerts },
    ];
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const getLdapState = async (): Promise<LdapConnectionInfo> => {
  return await getBackendSrv().get(`/api/admin/ldap/status`);
};

export const getLdapSyncStatus = async (): Promise<SyncInfo> => {
  return await getBackendSrv().get(`/api/admin/ldap-sync-status`);
};

export const syncLdapUser = async (userId: number) => {
  return await getBackendSrv().post(`/api/admin/ldap/sync/${userId}`);
};

export const getUserInfo = async (username: string): Promise<LdapUser> => {
  const response = await getBackendSrv().get(`/api/admin/ldap/${username}`);
  const { name, surname, email, login, isGrafanaAdmin, isDisabled, roles, teams } = response;
  return {
    info: { name, surname, email, login },
    permissions: { isGrafanaAdmin, isDisabled },
    roles,
    teams,
  };
};

export const getUser = async (id: number): Promise<User> => {
  return await getBackendSrv().get('/api/users/' + id);
};

export const getUserSessions = async (id: number) => {
  const sessions = await getBackendSrv().get('/api/admin/users/' + id + '/auth-tokens');
  sessions.reverse();

  return sessions.map((session: UserSession) => {
    return {
      id: session.id,
      isActive: session.isActive,
      seenAt: dateTime(session.seenAt).fromNow(),
      createdAt: dateTime(session.createdAt).format('MMMM DD, YYYY'),
      clientIp: session.clientIp,
      browser: session.browser,
      browserVersion: session.browserVersion,
      os: session.os,
      osVersion: session.osVersion,
      device: session.device,
    };
  });
};

export const revokeUserSession = async (tokenId: number, userId: number) => {
  return await getBackendSrv().post(`/api/admin/users/${userId}/revoke-auth-token`, {
    authTokenId: tokenId,
  });
};

export const revokeAllUserSessions = async (userId: number) => {
  return await getBackendSrv().post(`/api/admin/users/${userId}/logout`);
};
