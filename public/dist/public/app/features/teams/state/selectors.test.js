import { __assign } from "tslib";
import { getTeam, getTeamMembers, getTeams, isSignedInUserTeamAdmin } from './selectors';
import { getMockTeam, getMockTeamMembers, getMultipleMockTeams } from '../__mocks__/teamMocks';
import { OrgRole } from '../../../types';
describe('Teams selectors', function () {
    describe('Get teams', function () {
        var mockTeams = getMultipleMockTeams(5);
        it('should return teams if no search query', function () {
            var mockState = { teams: mockTeams, searchQuery: '', hasFetched: false };
            var teams = getTeams(mockState);
            expect(teams).toEqual(mockTeams);
        });
        it('Should filter teams if search query', function () {
            var mockState = { teams: mockTeams, searchQuery: '5', hasFetched: false };
            var teams = getTeams(mockState);
            expect(teams.length).toEqual(1);
        });
    });
});
describe('Team selectors', function () {
    describe('Get team', function () {
        var mockTeam = getMockTeam();
        it('should return team if matching with location team', function () {
            var mockState = {
                team: mockTeam,
                searchMemberQuery: '',
                members: [],
                groups: [],
            };
            var team = getTeam(mockState, '1');
            expect(team).toEqual(mockTeam);
        });
    });
    describe('Get members', function () {
        var mockTeamMembers = getMockTeamMembers(5, 5);
        it('should return team members', function () {
            var mockState = {
                team: {},
                searchMemberQuery: '',
                members: mockTeamMembers,
                groups: [],
            };
            var members = getTeamMembers(mockState);
            expect(members).toEqual(mockTeamMembers);
        });
    });
});
var signedInUserId = 1;
var setup = function (configOverrides) {
    var defaultConfig = {
        editorsCanAdmin: false,
        members: getMockTeamMembers(5, 5),
        signedInUser: {
            id: signedInUserId,
            isGrafanaAdmin: false,
            orgRole: OrgRole.Viewer,
        },
    };
    return __assign(__assign({}, defaultConfig), configOverrides);
};
describe('isSignedInUserTeamAdmin', function () {
    describe('when feature toggle editorsCanAdmin is turned off', function () {
        it('should return true', function () {
            var config = setup();
            var result = isSignedInUserTeamAdmin(config);
            expect(result).toBe(true);
        });
    });
    describe('when feature toggle editorsCanAdmin is turned on', function () {
        it('should return true if signed in user is grafanaAdmin', function () {
            var config = setup({
                editorsCanAdmin: true,
                signedInUser: {
                    id: signedInUserId,
                    isGrafanaAdmin: true,
                    orgRole: OrgRole.Viewer,
                },
            });
            var result = isSignedInUserTeamAdmin(config);
            expect(result).toBe(true);
        });
        it('should return true if signed in user is org admin', function () {
            var config = setup({
                editorsCanAdmin: true,
                signedInUser: {
                    id: signedInUserId,
                    isGrafanaAdmin: false,
                    orgRole: OrgRole.Admin,
                },
            });
            var result = isSignedInUserTeamAdmin(config);
            expect(result).toBe(true);
        });
        it('should return true if signed in user is team admin', function () {
            var config = setup({
                members: getMockTeamMembers(5, signedInUserId),
                editorsCanAdmin: true,
                signedInUser: {
                    id: signedInUserId,
                    isGrafanaAdmin: false,
                    orgRole: OrgRole.Viewer,
                },
            });
            var result = isSignedInUserTeamAdmin(config);
            expect(result).toBe(true);
        });
        it('should return false if signed in user is not grafanaAdmin, org admin or team admin', function () {
            var config = setup({
                editorsCanAdmin: true,
                signedInUser: {
                    id: signedInUserId,
                    isGrafanaAdmin: false,
                    orgRole: OrgRole.Viewer,
                },
            });
            var result = isSignedInUserTeamAdmin(config);
            expect(result).toBe(false);
        });
    });
});
//# sourceMappingURL=selectors.test.js.map