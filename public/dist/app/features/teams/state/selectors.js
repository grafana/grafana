export var getSearchQuery = function (state) { return state.searchQuery; };
export var getSearchMemberQuery = function (state) { return state.searchMemberQuery; };
export var getTeamGroups = function (state) { return state.groups; };
export var getTeamsCount = function (state) { return state.teams.length; };
export var getTeam = function (state, currentTeamId) {
    if (state.team.id === parseInt(currentTeamId, 10)) {
        return state.team;
    }
    return null;
};
export var getTeams = function (state) {
    var regex = RegExp(state.searchQuery, 'i');
    return state.teams.filter(function (team) {
        return regex.test(team.name);
    });
};
export var getTeamMembers = function (state) {
    var regex = RegExp(state.searchMemberQuery, 'i');
    return state.members.filter(function (member) {
        return regex.test(member.login) || regex.test(member.email);
    });
};
//# sourceMappingURL=selectors.js.map