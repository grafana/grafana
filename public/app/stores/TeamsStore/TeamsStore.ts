import { types, getEnv, flow } from 'mobx-state-tree';

export const TeamMember = types.model('TeamMember', {
  userId: types.identifier(types.number),
  teamId: types.number,
  avatarUrl: types.string,
  email: types.string,
  login: types.string,
});

type TeamMemberType = typeof TeamMember.Type;
export interface ITeamMember extends TeamMemberType {}

export const TeamGroup = types.model('TeamGroup', {
  groupId: types.identifier(types.string),
  teamId: types.number,
});

type TeamGroupType = typeof TeamGroup.Type;
export interface ITeamGroup extends TeamGroupType {}

export const Team = types
  .model('Team', {
    id: types.identifier(types.number),
    name: types.string,
    avatarUrl: types.string,
    email: types.string,
    memberCount: types.number,
    search: types.optional(types.string, ''),
    members: types.optional(types.map(TeamMember), {}),
    groups: types.optional(types.map(TeamGroup), {}),
  })
  .views(self => ({
    get filteredMembers() {
      let members = this.members.values();
      let regex = new RegExp(self.search, 'i');
      return members.filter(member => {
        return regex.test(member.login) || regex.test(member.email);
      });
    },
  }))
  .actions(self => ({
    setName(name: string) {
      self.name = name;
    },

    setEmail(email: string) {
      self.email = email;
    },

    setSearchQuery(query: string) {
      self.search = query;
    },

    update: flow(function* load() {
      const backendSrv = getEnv(self).backendSrv;

      yield backendSrv.put(`/api/teams/${self.id}`, {
        name: self.name,
        email: self.email,
      });
    }),

    loadMembers: flow(function* load() {
      const backendSrv = getEnv(self).backendSrv;
      const rsp = yield backendSrv.get(`/api/teams/${self.id}/members`);
      self.members.clear();

      for (let member of rsp) {
        self.members.set(member.userId.toString(), TeamMember.create(member));
      }
    }),

    removeMember: flow(function* load(member: ITeamMember) {
      const backendSrv = getEnv(self).backendSrv;
      yield backendSrv.delete(`/api/teams/${self.id}/members/${member.userId}`);
      // remove from store map
      self.members.delete(member.userId.toString());
    }),

    addMember: flow(function* load(userId: number) {
      const backendSrv = getEnv(self).backendSrv;
      yield backendSrv.post(`/api/teams/${self.id}/members`, { userId: userId });
    }),

    loadGroups: flow(function* load() {
      const backendSrv = getEnv(self).backendSrv;
      const rsp = yield backendSrv.get(`/api/teams/${self.id}/groups`);
      self.groups.clear();

      for (let group of rsp) {
        self.groups.set(group.groupId, TeamGroup.create(group));
      }
    }),

    addGroup: flow(function* load(groupId: string) {
      const backendSrv = getEnv(self).backendSrv;
      yield backendSrv.post(`/api/teams/${self.id}/groups`, { groupId: groupId });
      self.groups.set(
        groupId,
        TeamGroup.create({
          teamId: self.id,
          groupId: groupId,
        })
      );
    }),

    removeGroup: flow(function* load(groupId: string) {
      const backendSrv = getEnv(self).backendSrv;
      yield backendSrv.delete(`/api/teams/${self.id}/groups/${groupId}`);
      self.groups.delete(groupId);
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
