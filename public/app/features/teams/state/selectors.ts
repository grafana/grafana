export const getSearchQuery = state => state.searchQuery;
export const getSearchMemberQuery = state => state.searchMemberQuery;

export const getTeam = (state, currentTeamId) => {
  if (state.team.id === parseInt(currentTeamId)) {
    return state.team;
  }
};

export const getTeams = state => {
  const regex = RegExp(state.searchQuery, 'i');

  return state.teams.filter(team => {
    return regex.test(team.name);
  });
};

export const getTeamMembers = state => {
  const regex = RegExp(state.searchMemberQuery, 'i');

  return state.members.filter(member => {
    return regex.test(member.login) || regex.test(member.email);
  });
};
