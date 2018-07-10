import { types, getEnv, flow } from 'mobx-state-tree';

export const Team = types
  .model('Team', {
    id: types.identifier(types.number),
    name: types.string,
    avatarUrl: types.string,
    email: types.string,
    memberCount: types.number,
  })
  .actions(self => ({
    setName(name: string) {
      self.name = name;
    },

    setEmail(email: string) {
      self.email = email;
    },

    update: flow(function* load() {
      const backendSrv = getEnv(self).backendSrv;

      yield backendSrv.put(`/api/teams/${self.id}`, {
        name: self.name,
        email: self.email,
      });
    }),
  }));

type TeamType = typeof Team.Type;
export interface ITeam extends TeamType {}

export const TeamsStore = types
  .model('TeamsStore', {
    map: types.map(Team),
    search: types.optional(types.string, ''),
  })
  .views(self => ({
    get filteredTeams() {
      let teams = this.map.values();
      let regex = new RegExp(self.search, 'i');
      return teams.filter(team => {
        return regex.test(team.name);
      });
    },
  }))
  .actions(self => ({
    loadTeams: flow(function* load() {
      const backendSrv = getEnv(self).backendSrv;
      const rsp = yield backendSrv.get('/api/teams/search/', { perpage: 50, page: 1 });
      self.map.clear();

      for (let team of rsp.teams) {
        self.map.set(team.id.toString(), Team.create(team));
      }
    }),

    setSearchQuery(query: string) {
      self.search = query;
    },

    loadById: flow(function* load(id: string) {
      if (self.map.has(id)) {
        return;
      }

      const backendSrv = getEnv(self).backendSrv;
      const team = yield backendSrv.get(`/api/teams/${id}`);
      self.map.set(id, Team.create(team));
    }),
  }));
