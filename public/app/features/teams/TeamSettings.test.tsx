import { render, screen, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { MOCK_TEAMS } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';

import { Props, TeamSettings } from './TeamSettings';

jest.spyOn(contextSrv, 'hasPermission').mockImplementation(() => true);
jest.spyOn(contextSrv, 'hasPermissionInMetadata').mockImplementation(() => true);

setBackendSrv(backendSrv);
setupMockServer();

const setup = (propOverrides?: object) => {
  const team = MOCK_TEAMS[0];
  const props: Props = {
    team: {
      id: Number(team.metadata.labels['grafana.app/deprecatedInternalID']),
      uid: team.metadata.name,
      memberCount: 0,
      name: team.spec.title,
      orgId: 1,
      isProvisioned: false,
    },
    updateTeam: jest.fn(),
  };

  Object.assign(props, propOverrides);

  return render(<TeamSettings {...props} />);
};

describe('Team settings', () => {
  it('should render component', async () => {
    setup();

    expect(await screen.findByText('Team details')).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    const mockUpdate = jest.fn();
    const { user } = setup({ updateTeam: mockUpdate });
    await screen.findByText('Team details');

    await user.clear(screen.getByRole('textbox', { name: /Name/ }));
    await user.type(screen.getByLabelText(/Email/i), 'team@test.com');
    await user.click(screen.getByRole('button', { name: 'Save team details' }));

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    await waitFor(() => expect(mockUpdate).not.toHaveBeenCalled());
  });

  it('should submit form with correct values', async () => {
    const mockUpdate = jest.fn();
    const { user } = setup({ updateTeam: mockUpdate });

    await user.clear(screen.getByRole('textbox', { name: /Name/ }));
    await user.clear(screen.getByLabelText(/Email/i));
    await user.type(screen.getByRole('textbox', { name: /Name/ }), 'New team');
    await user.type(screen.getByLabelText(/Email/i), 'team@test.com');
    await user.click(screen.getByRole('button', { name: 'Save team details' }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith('New team', 'team@test.com'));
  });
});
