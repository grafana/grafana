export const getTeamGroups = (state) => state.groups;
export const getTeam = (state, currentTeamId) => {
    if (state.team.id === parseInt(currentTeamId, 10)) {
        return state.team;
    }
    return null;
};
//# sourceMappingURL=selectors.js.map