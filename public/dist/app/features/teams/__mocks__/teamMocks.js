export var getMultipleMockTeams = function (numberOfTeams) {
    var teams = [];
    for (var i = 1; i <= numberOfTeams; i++) {
        teams.push({
            id: i,
            name: "test-" + i,
            avatarUrl: 'some/url/',
            email: "test-" + i + "@test.com",
            memberCount: i,
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
    };
};
export var getMockTeamMembers = function (amount) {
    var teamMembers = [];
    for (var i = 1; i <= amount; i++) {
        teamMembers.push({
            userId: i,
            teamId: 1,
            avatarUrl: 'some/url/',
            email: 'test@test.com',
            login: "testUser-" + i,
            labels: ['label 1', 'label 2'],
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
        login: 'testUser',
        labels: [],
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