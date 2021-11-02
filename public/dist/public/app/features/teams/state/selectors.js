import { OrgRole, TeamPermissionLevel } from 'app/types';
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
        return regex.test(member.login) || regex.test(member.email) || regex.test(member.name);
    });
};
export var isSignedInUserTeamAdmin = function (config) {
    var members = config.members, signedInUser = config.signedInUser, editorsCanAdmin = config.editorsCanAdmin;
    var userInMembers = members.find(function (m) { return m.userId === signedInUser.id; });
    var permission = userInMembers ? userInMembers.permission : TeamPermissionLevel.Member;
    return isPermissionTeamAdmin({ permission: permission, signedInUser: signedInUser, editorsCanAdmin: editorsCanAdmin });
};
export var isPermissionTeamAdmin = function (config) {
    var permission = config.permission, signedInUser = config.signedInUser, editorsCanAdmin = config.editorsCanAdmin;
    var isAdmin = signedInUser.isGrafanaAdmin || signedInUser.orgRole === OrgRole.Admin;
    var userIsTeamAdmin = permission === TeamPermissionLevel.Admin;
    var isSignedInUserTeamAdmin = isAdmin || userIsTeamAdmin;
    return isSignedInUserTeamAdmin || !editorsCanAdmin;
};
//# sourceMappingURL=selectors.js.map