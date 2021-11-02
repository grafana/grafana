import { TeamPermissionLevel } from 'app/types';
export var getMultipleMockTeams = function (numberOfTeams) {
    var teams = [];
    for (var i = 1; i <= numberOfTeams; i++) {
        teams.push({
            id: i,
            name: "test-" + i,
            avatarUrl: 'some/url/',
            email: "test-" + i + "@test.com",
            memberCount: i,
            permission: TeamPermissionLevel.Member,
        });
    }
    return teams;
};
export var getMockTeam = function () {
    return {
        id: 1,
        name: 'test',
        avatarUrl: 'some/url/',
        email: 'test@test.com',
        memberCount: 1,
        permission: TeamPermissionLevel.Member,
    };
};
export var getMockTeamMembers = function (amount, teamAdminId) {
    var teamMembers = [];
    for (var i = 1; i <= amount; i++) {
        teamMembers.push({
            userId: i,
            teamId: 1,
            avatarUrl: 'some/url/',
            email: 'test@test.com',
            name: 'testName',
            login: "testUser-" + i,
            labels: ['label 1', 'label 2'],
            permission: i === teamAdminId ? TeamPermissionLevel.Admin : TeamPermissionLevel.Member,
        });
    }
    return teamMembers;
};
export var getMockTeamMember = function () {
    return {
        userId: 1,
        teamId: 1,
        avatarUrl: 'some/url/',
        email: 'test@test.com',
        name: 'testName',
        login: 'testUser',
        labels: [],
        permission: TeamPermissionLevel.Member,
    };
};
export var getMockTeamGroups = function (amount) {
    var groups = [];
    for (var i = 1; i <= amount; i++) {
        groups.push({
            groupId: "group-" + i,
            teamId: 1,
        });
    }
    return groups;
};
//# sourceMappingURL=teamMocks.js.map