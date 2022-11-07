import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';

import { User } from 'app/core/services/context_srv';
import { configureStore } from 'app/store/configureStore';

import { OrgRole, TeamMember } from '../../types';

import { Props, TeamMembers } from './TeamMembers';
import { getMockTeamMembers } from './__mocks__/teamMocks';
import { setSearchMemberQuery } from './state/reducers';

const signedInUserId = 1;

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: jest.fn().mockResolvedValue([{ userId: 1, login: 'Test' }]),
  }),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    bootData: { navTree: [], user: {} },
  },
}));

const setup = (propOverrides?: object) => {
  const store = configureStore();

  const props: Props = {
    members: [] as TeamMember[],
    searchMemberQuery: '',
    setSearchMemberQuery: mockToolkitActionCreator(setSearchMemberQuery),
    addTeamMember: jest.fn(),
    syncEnabled: false,
    editorsCanAdmin: false,
    signedInUser: {
      id: signedInUserId,
      isGrafanaAdmin: false,
      orgRole: OrgRole.Viewer,
    } as User,
  };

  Object.assign(props, propOverrides);

  render(
    <Provider store={store}>
      <TeamMembers {...props} />
    </Provider>
  );
};

describe('TeamMembers', () => {
  it('should render team members', async () => {
    setup({ members: getMockTeamMembers(1, 1) });
    expect(await screen.findAllByRole('row')).toHaveLength(2);
  });

  it('should add user to a team', async () => {
    const mockAdd = jest.fn();
    setup({ addTeamMember: mockAdd });
    await userEvent.type(screen.getByLabelText('User picker'), 'Test{enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Add to team' }));
    await waitFor(() => expect(mockAdd).toHaveBeenCalledWith(1));
  });
});
