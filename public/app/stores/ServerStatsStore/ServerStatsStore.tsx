import { types, getEnv, flow } from 'mobx-state-tree';

export const ServerStat = types.model('ServerStat', {
  name: types.string,
  value: types.optional(types.number, 0),
});

export const ServerStatsStore = types
  .model('ServerStatsStore', {
    stats: types.array(ServerStat),
    error: types.optional(types.string, ''),
  })
  .actions(self => ({
    load: flow(function* load() {
      let backendSrv = getEnv(self).backendSrv;

      let res = yield backendSrv.get('/api/admin/stats');
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
