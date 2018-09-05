export const getSearchQuery = state => state.searchQuery;

export const getTeams = state => {
  const regex = RegExp(state.searchQuery, 'i');

  return state.teams.filter(team => {
    return regex.test(team.name);
  });
};
