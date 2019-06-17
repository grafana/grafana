import { getBackendSrv } from '@grafana/runtime';

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
