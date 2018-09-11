import { Team, TeamsState, TeamState } from 'app/types';

export const getSearchQuery = (state: TeamsState) => state.searchQuery;
export const getSearchMemberQuery = (state: TeamState) => state.searchMemberQuery;
export const getTeamGroups = (state: TeamState) => state.groups;
export const getTeamsCount = (state: TeamsState) => state.teams.length;

export const getTeam = (state: TeamState, currentTeamId): Team | null => {
  if (state.team.id === parseInt(currentTeamId, 10)) {
    return state.team;
  }

  return null;
};

export const getTeams = (state: TeamsState) => {
  const regex = RegExp(state.searchQuery, 'i');

  return state.teams.filter(team => {
    return regex.test(team.name);
  });
};

export const getTeamMembers = (state: TeamState) => {
  const regex = RegExp(state.searchMemberQuery, 'i');

  return state.members.filter(member => {
    return regex.test(member.login) || regex.test(member.email);
  });
};
