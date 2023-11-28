import { getMockTeam } from '../__mocks__/teamMocks';
import { getTeam } from './selectors';
describe('Team selectors', () => {
    describe('Get team', () => {
        const mockTeam = getMockTeam();
        it('should return team if matching with location team', () => {
            const mockState = {
                team: mockTeam,
                searchMemberQuery: '',
                members: [],
                groups: [],
            };
            const team = getTeam(mockState, '1');
            expect(team).toEqual(mockTeam);
        });
    });
});
//# sourceMappingURL=selectors.test.js.map