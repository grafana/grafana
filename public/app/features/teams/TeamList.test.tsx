import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestProvider } from 'test/helpers/TestProvider';

import { contextSrv } from 'app/core/services/context_srv';
import { Team } from 'app/types/teams';

import { Props, TeamList } from './TeamList';
import { getMockTeam, getMultipleMockTeams } from './mocks/teamMocks';

jest.mock('app/core/core', () => ({
  contextSrv: {
    hasPermission: (action: string) => true,
    licensedAccessControlEnabled: () => false,
    user: {
      helpFlags1: 0,
    },
  },
}));

const setup = (propOverrides?: object) => {
  const props: Props = {
    teams: [] as Team[],
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
    rolesLoading: false,
  };

  Object.assign(props, propOverrides);

  render(
    <TestProvider>
      <TeamList {...props} />
    </TestProvider>
  );
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

it('should call delete team', async () => {
  const mockDelete = jest.fn();
  const mockTeam = getMockTeam();
  jest.spyOn(contextSrv, 'hasPermissionInMetadata').mockReturnValue(true);
  setup({ deleteTeam: mockDelete, teams: [mockTeam], totalCount: 1, hasFetched: true });
  await userEvent.click(screen.getByRole('button', { name: `Delete team ${mockTeam.name}` }));
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(() => {
    expect(mockDelete).toHaveBeenCalledWith(mockTeam.uid);
  });
});
