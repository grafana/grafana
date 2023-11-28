import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { contextSrv } from 'app/core/services/context_srv';
import { TeamList } from './TeamList';
import { getMockTeam, getMultipleMockTeams } from './__mocks__/teamMocks';
jest.mock('app/core/core', () => ({
    contextSrv: {
        hasPermission: (action) => true,
        licensedAccessControlEnabled: () => false,
    },
}));
const setup = (propOverrides) => {
    const props = {
        teams: [],
        noTeams: false,
        loadTeams: jest.fn(),
        deleteTeam: jest.fn(),
        changePage: jest.fn(),
        changeQuery: jest.fn(),
        changeSort: jest.fn(),
        query: '',
        totalPages: 0,
        page: 0,
        hasFetched: false,
        perPage: 10,
    };
    Object.assign(props, propOverrides);
    render(React.createElement(TestProvider, null,
        React.createElement(TeamList, Object.assign({}, props))));
};
describe('TeamList', () => {
    it('should render teams table', () => {
        setup({ teams: getMultipleMockTeams(5), teamsCount: 5, hasFetched: true });
        expect(screen.getAllByRole('row')).toHaveLength(6); // 5 teams plus table header row
    });
    describe('when user has access to create a team', () => {
        it('should enable the new team button', () => {
            jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
            setup({
                teams: getMultipleMockTeams(1),
                totalCount: 1,
                hasFetched: true,
            });
            expect(screen.getByRole('link', { name: /new team/i })).not.toHaveStyle('pointer-events: none');
        });
    });
    describe('when user does not have access to create a team', () => {
        it('should disable the new team button', () => {
            jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
            setup({
                teams: getMultipleMockTeams(1),
                totalCount: 1,
                hasFetched: true,
            });
            expect(screen.getByRole('link', { name: /new team/i })).toHaveStyle('pointer-events: none');
        });
    });
});
it('should call delete team', () => __awaiter(void 0, void 0, void 0, function* () {
    const mockDelete = jest.fn();
    const mockTeam = getMockTeam();
    jest.spyOn(contextSrv, 'hasPermissionInMetadata').mockReturnValue(true);
    setup({ deleteTeam: mockDelete, teams: [mockTeam], totalCount: 1, hasFetched: true });
    yield userEvent.click(screen.getByRole('button', { name: `Delete team ${mockTeam.name}` }));
    yield userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    yield waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith(mockTeam.id);
    });
}));
//# sourceMappingURL=TeamList.test.js.map