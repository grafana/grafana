import { types, getEnv, flow } from 'mobx-state-tree';
import { ServerStat } from './ServerStat';

export const ServerStatsStore = types
  .model('ServerStatsStore', {
    stats: types.array(ServerStat),
    error: types.optional(types.string, ''),
  })
  .actions(self => ({
    load: flow(function* load() {
      const backendSrv = getEnv(self).backendSrv;
      const res = yield backendSrv.get('/api/admin/stats');
      self.stats.clear();
      self.stats.push(ServerStat.create({ name: 'Total dashboards', value: res.dashboards }));
      self.stats.push(ServerStat.create({ name: 'Total users', value: res.users }));
      self.stats.push(ServerStat.create({ name: 'Active users (seen last 30 days)', value: res.activeUsers }));
      self.stats.push(ServerStat.create({ name: 'Total orgs', value: res.orgs }));
      self.stats.push(ServerStat.create({ name: 'Total playlists', value: res.playlists }));
      self.stats.push(ServerStat.create({ name: 'Total snapshots', value: res.snapshots }));
      self.stats.push(ServerStat.create({ name: 'Total dashboard tags', value: res.tags }));
      self.stats.push(ServerStat.create({ name: 'Total starred dashboards', value: res.stars }));
      self.stats.push(ServerStat.create({ name: 'Total alerts', value: res.alerts }));
    }),
  }));
