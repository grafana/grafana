import { getBackendSrv } from '@grafana/runtime';

interface AnonServerStat {
  activeDevices?: number;
  activeAnonymousUsers?: number;
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
  let resp = await getBackendSrv()
    .get('/api/anonymous/stats')
    .then((res) => {
      return res;
    })
    .catch((err) => {
      console.error(err);
      // FIXME:
      // return null;
    });
  return getBackendSrv()
    .get('api/admin/stats')
    .then((res) => {
      if (resp) {
        res.activeDevices = resp;
        res.activeAnonymousUsers = resp / 3;
      }
      return res;
    })
    .catch((err) => {
      console.error(err);
      return null;
    });
};
