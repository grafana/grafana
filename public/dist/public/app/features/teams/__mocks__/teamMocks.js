import { TeamPermissionLevel } from 'app/types';
export const getMultipleMockTeams = (numberOfTeams) => {
    const teams = [];
    for (let i = 1; i <= numberOfTeams; i++) {
        teams.push(getMockTeam(i));
    }
    return teams;
};
export const getMockTeam = (i = 1, overrides = {}) => {
    return Object.assign({ id: i, name: `test-${i}`, avatarUrl: 'some/url/', email: `test-${i}@test.com`, memberCount: i, permission: TeamPermissionLevel.Member, accessControl: { isEditor: false }, orgId: 0 }, overrides);
};
export const getMockTeamMember = () => {
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
export const getMockTeamGroups = (amount) => {
    const groups = [];
    for (let i = 1; i <= amount; i++) {
        groups.push({
            groupId: `group-${i}`,
            teamId: 1,
        });
    }
    return groups;
};
//# sourceMappingURL=teamMocks.js.map