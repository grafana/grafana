import { UserEvent } from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { render, screen, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { MOCK_TEAMS } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';

import CreateTeam from './CreateTeam';

setBackendSrv(backendSrv);
setupMockServer();

const setup = async () => {
  const view = render(
    <Routes>
      <Route path="/org/teams/create" element={<CreateTeam />} />
      <Route path="/org/teams/edit/:id" element={<div>Edit team page</div>} />
    </Routes>,
    {
      historyOptions: { initialEntries: ['/org/teams/create'] },
    }
  );
  await waitFor(async () => expect(screen.queryAllByTestId('Spinner')).toHaveLength(0));
  return view;
};

const attemptCreateTeam = async (
  user: UserEvent,
  {
    teamName,
    teamEmail,
    autocreateTeamFolder,
  }: { teamName?: string; teamEmail?: string; autocreateTeamFolder?: boolean } = {}
) => {
  teamName && (await user.type(screen.getByRole('textbox', { name: /name/i }), teamName));
  teamEmail && (await user.type(screen.getByLabelText(/email/i), teamEmail));
  if (autocreateTeamFolder) {
    await user.click(screen.getByRole('checkbox', { name: /autocreate team folder/i }));
  }
  await user.click(screen.getByRole('button', { name: /create/i }));
};

describe('Create team', () => {
  beforeEach(() => {
    contextSrv.licensedAccessControlEnabled = () => false;
    contextSrv.hasPermission = () => true;
    contextSrv.hasPermissionInMetadata = () => true;
    contextSrv.fetchUserPermissions = () => Promise.resolve();
  });

  it('should render component', async () => {
    await setup();
    await waitFor(async () => expect(screen.queryAllByTestId('Spinner')).toHaveLength(0));
    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /autocreate team folder/i })).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should show team success result with link after create', async () => {
    const { user } = await setup();
    await attemptCreateTeam(user, { teamName: 'Test team', teamEmail: 'team@test.com' });

    expect(await screen.findByText(/team created successfully/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open team details/i })).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    const { user } = await setup();
    await attemptCreateTeam(user, { teamEmail: 'team@test.com' });

    expect(await screen.findAllByRole('alert')).toHaveLength(1);
    expect(screen.getByText(/team name is required/i)).toBeInTheDocument();
    expect(screen.queryByText(/edit team page/i)).not.toBeInTheDocument();
  });

  it('should create a folder when autocreate team folder is checked', async () => {
    const { user } = await setup();
    await attemptCreateTeam(user, { teamName: 'Team with folder', autocreateTeamFolder: true });

    expect(await screen.findByText(/team created successfully/i)).toBeInTheDocument();
    expect(await screen.findByText(/folder created successfully/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open folder/i })).toBeInTheDocument();
  });

  it('prevents creation of duplicate team name', async () => {
    jest.spyOn(console, 'error').mockImplementation();
    const { user } = await setup();
    await attemptCreateTeam(user, { teamName: MOCK_TEAMS[0].spec.title });

    expect(screen.queryByText(/edit team page/i)).not.toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(/team name taken|failed to create team/i);
  });
});
