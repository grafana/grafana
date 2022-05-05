import { User } from 'app/core/services/context_srv';
import { Team, TeamsState, TeamState, TeamMember, OrgRole, TeamPermissionLevel } from 'app/types';

export const getSearchQuery = (state: TeamsState) => state.searchQuery;
export const getSearchMemberQuery = (state: TeamState) => state.searchMemberQuery;
export const getTeamGroups = (state: TeamState) => state.groups;
export const getTeamsCount = (state: TeamsState) => state.teams.length;
export const getTeamsSearchPage = (state: TeamsState) => state.searchPage;

export const getTeam = (state: TeamState, currentTeamId: any): Team | null => {
  if (state.team.id === parseInt(currentTeamId, 10)) {
    return state.team;
  }

  return null;
};

export const getTeams = (state: TeamsState) => {
  const regex = RegExp(state.searchQuery, 'i');

  return state.teams.filter((team) => {
    return regex.test(team.name);
  });
};

export const getTeamMembers = (state: TeamState) => {
  const regex = RegExp(state.searchMemberQuery, 'i');

  return state.members.filter((member) => {
    return regex.test(member.login) || regex.test(member.email) || regex.test(member.name);
  });
};

export interface Config {
  members: TeamMember[];
  editorsCanAdmin: boolean;
  signedInUser: User;
}

export const isSignedInUserTeamAdmin = (config: Config): boolean => {
  const { members, signedInUser, editorsCanAdmin } = config;
  const userInMembers = members.find((m) => m.userId === signedInUser.id);
  const permission = userInMembers ? userInMembers.permission : TeamPermissionLevel.Member;

  return isPermissionTeamAdmin({ permission, signedInUser, editorsCanAdmin });
};

export interface PermissionConfig {
  permission: TeamPermissionLevel;
  editorsCanAdmin: boolean;
  signedInUser: User;
}

export const isPermissionTeamAdmin = (config: PermissionConfig): boolean => {
  const { permission, signedInUser, editorsCanAdmin } = config;
  const isAdmin = signedInUser.isGrafanaAdmin || signedInUser.orgRole === OrgRole.Admin;
  const userIsTeamAdmin = permission === TeamPermissionLevel.Admin;
  const isSignedInUserTeamAdmin = isAdmin || userIsTeamAdmin;

  return isSignedInUserTeamAdmin || !editorsCanAdmin;
};
