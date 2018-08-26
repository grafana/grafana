import { types, getEnv, flow } from 'mobx-state-tree';

export const TeamMemberModel = types.model('TeamMember', {
  userId: types.identifier(types.number),
  teamId: types.number,
  avatarUrl: types.string,
  email: types.string,
  login: types.string,
});

type TeamMemberType = typeof TeamMemberModel.Type;
export interface TeamMember extends TeamMemberType {}

export const TeamGroupModel = types.model('TeamGroup', {
  groupId: types.identifier(types.string),
  teamId: types.number,
});

type TeamGroupType = typeof TeamGroupModel.Type;
export interface TeamGroup extends TeamGroupType {}

export const TeamModel = types
  .model('Team', {
    id: types.identifier(types.number),
    name: types.string,
    avatarUrl: types.string,
    email: types.string,
    memberCount: types.number,
    search: types.optional(types.string, ''),
    members: types.optional(types.map(TeamMemberModel), {}),
    groups: types.optional(types.map(TeamGroupModel), {}),
  })
  .views(self => ({
    get filteredMembers() {
      const members = this.members.values();
      const regex = new RegExp(self.search, 'i');
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

      for (const member of rsp) {
        self.members.set(member.userId.toString(), TeamMemberModel.create(member));
      }
    }),

    removeMember: flow(function* load(member: TeamMember) {
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

      for (const group of rsp) {
        self.groups.set(group.groupId, TeamGroupModel.create(group));
      }
    }),

    addGroup: flow(function* load(groupId: string) {
      const backendSrv = getEnv(self).backendSrv;
      yield backendSrv.post(`/api/teams/${self.id}/groups`, { groupId: groupId });
      self.groups.set(
        groupId,
        TeamGroupModel.create({
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

type TeamType = typeof TeamModel.Type;
export interface Team extends TeamType {}

export const TeamsStore = types
  .model('TeamsStore', {
    map: types.map(TeamModel),
    search: types.optional(types.string, ''),
  })
  .views(self => ({
    get filteredTeams() {
      const teams = this.map.values();
      const regex = new RegExp(self.search, 'i');
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

      for (const team of rsp.teams) {
        self.map.set(team.id.toString(), TeamModel.create(team));
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
      self.map.set(id, TeamModel.create(team));
    }),
  }));
