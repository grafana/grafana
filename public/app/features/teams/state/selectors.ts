export const getSearchQuery = state => state.searchQuery;
export const getSearchMemberQuery = state => state.searchMemberQuery;

export const getTeam = (state, currentTeamId) => {
  if (state.team.id === currentTeamId) {
    console.log('yes');
    return state.team;
  }
};

export const getTeams = state => {
  const regex = RegExp(state.searchQuery, 'i');

  return state.teams.filter(team => {
    return regex.test(team.name);
  });
};
