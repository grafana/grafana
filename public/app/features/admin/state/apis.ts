import { getBackendSrv } from 'app/core/services/backend_srv';

export interface ServerStat {
  name: string;
  value: number;
}

export const getServerStats = async (): Promise<ServerStat[]> => {
  try {
    const res = await getBackendSrv().get('api/admin/stats');
    return [
      { name: 'Total users', value: res.users },
      { name: 'Total dashboards', value: res.dashboards },
      { name: 'Active users (seen last 30 days)', value: res.activeUsers },
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
