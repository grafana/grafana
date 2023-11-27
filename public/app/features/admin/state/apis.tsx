import { getBackendSrv } from '@grafana/runtime';

interface AnonServerStat {
  activeDevices: number;
}

export interface ServerStat extends AnonServerStat {
  activeAdmins: number;
  activeEditors: number;
  activeSessions: number;
  activeUsers: number;
  activeViewers: number;
  admins: number;
  alerts: number;
  dashboards: number;
  datasources: number;
  editors: number;
  orgs: number;
  playlists: number;
  snapshots: number;
  stars: number;
  tags: number;
  users: number;
  viewers: number;
}

export const getServerStats = async (): Promise<ServerStat | null> => {
  try {
    // Issue both requests simultaneously
    const [adminResponse, anonymousStats]: [PromiseSettledResult<ServerStat>, PromiseSettledResult<number>] =
      await Promise.allSettled([getBackendSrv().get('/api/admin/stats'), getBackendSrv().get('/api/anonymous/stats')]);
    if (adminResponse.status === 'rejected') {
      throw adminResponse.reason;
    }

    if (adminResponse && anonymousStats.status === 'fulfilled') {
      adminResponse.value.activeDevices = anonymousStats.value;
    }

    return adminResponse.value;
  } catch (err) {
    console.error(err);
    return null;
  }
};
