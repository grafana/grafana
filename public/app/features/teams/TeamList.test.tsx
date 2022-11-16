import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';

import { contextSrv, User } from 'app/core/services/context_srv';

import { configureStore } from '../../store/configureStore';
import { OrgRole, Team } from '../../types';

import { Props, TeamList } from './TeamList';
import { getMockTeam, getMultipleMockTeams } from './__mocks__/teamMocks';
import { setSearchQuery, setTeamsSearchPage } from './state/reducers';

jest.mock('app/core/config', () => ({
  ...jest.requireActual('app/core/config'),
  featureToggles: { accesscontrol: false },
}));

const setup = (propOverrides?: object) => {
  const store = configureStore();
  const props: Props = {
    teams: [] as Team[],
    loadTeams: jest.fn(),
    deleteTeam: jest.fn(),
    setSearchQuery: mockToolkitActionCreator(setSearchQuery),
    setTeamsSearchPage: mockToolkitActionCreator(setTeamsSearchPage),
    searchQuery: '',
    searchPage: 1,
    teamsCount: 0,
    hasFetched: false,
    editorsCanAdmin: false,
    signedInUser: {
      id: 1,
      orgRole: OrgRole.Viewer,
    } as User,
  };

  Object.assign(props, propOverrides);

  contextSrv.user = props.signedInUser;

  render(
    <Provider store={store}>
      <TeamList {...props} />
    </Provider>
  );
};

describe('TeamList', () => {
  it('should render teams table', () => {
    setup({ teams: getMultipleMockTeams(5), teamsCount: 5, hasFetched: true });
    expect(screen.getAllByRole('row')).toHaveLength(6); // 5 teams plus table header row
  });

  describe('when feature toggle editorsCanAdmin is turned on', () => {
    describe('and signed in user is not viewer', () => {
      it('should enable the new team button', () => {
        setup({
          teams: getMultipleMockTeams(1),
          teamsCount: 1,
          hasFetched: true,
          editorsCanAdmin: true,
          signedInUser: {
            id: 1,
            orgRole: OrgRole.Editor,
          } as User,
        });

        expect(screen.getByRole('link', { name: /new team/i })).not.toHaveStyle('pointer-events: none');
      });
    });

    describe('and signed in user is a viewer', () => {
      it('should disable the new team button', () => {
        setup({
          teams: getMultipleMockTeams(1),
          teamsCount: 1,
          hasFetched: true,
          editorsCanAdmin: true,
          signedInUser: {
            id: 1,
            orgRole: OrgRole.Viewer,
          } as User,
        });

        expect(screen.getByRole('link', { name: /new team/i })).toHaveStyle('pointer-events: none');
      });
    });
  });
});

it('should call delete team', async () => {
  const mockDelete = jest.fn();
  const mockTeam = getMockTeam();
  setup({ deleteTeam: mockDelete, teams: [mockTeam], teamsCount: 1, hasFetched: true });
  await userEvent.click(screen.getByRole('button', { name: `Delete team ${mockTeam.name}` }));
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await waitFor(() => {
    expect(mockDelete).toHaveBeenCalledWith(mockTeam.id);
  });
});
