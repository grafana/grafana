import { types, getEnv, flow } from 'mobx-state-tree';

export const Team = types.model('Team', {
  id: types.identifier(types.number),
  name: types.string,
  avatarUrl: types.string,
  email: types.string,
  memberCount: types.number,
});

type TeamType = typeof Team.Type;
export interface ITeam extends TeamType {}

export const TeamsStore = types
  .model('TeamsStore', {
    list: types.array(Team),
    search: types.optional(types.string, ''),
  })
  .views(self => ({
    get filteredTeams() {
      let regex = new RegExp(self.search, 'i');
      return self.list.filter(team => {
        return regex.test(team.name);
      });
    },
  }))
  .actions(self => ({
    load: flow(function* load() {
      const backendSrv = getEnv(self).backendSrv;
      const rsp = yield backendSrv.get('/api/teams/search/', { perpage: 50, page: 1 });
      self.list.clear();

      for (let team of rsp.teams) {
        self.list.push(Team.create(team));
      }
    }),

    setSearchQuery(query: string) {
      self.search = query;
    },
  }));
