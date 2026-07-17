import { HttpResponse, http } from 'msw';
import { render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { MOCK_TEAMS } from '@grafana/test-utils/unstable';
import { ModalRoot } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';

import { appEvents } from '../../core/app_events';
import { ShowModalReactEvent } from '../../types/events';

import { TeamDeleteModal } from './TeamDeleteModal';
import TeamList from './TeamList';

setBackendSrv(backendSrv);
const server = setupMockServer();

describe('TeamList', () => {
  beforeEach(() => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    jest.spyOn(contextSrv, 'hasPermissionInMetadata').mockReturnValue(true);
    jest.spyOn(contextSrv, 'fetchUserPermissions').mockResolvedValue();
  });

  it('should render teams table', async () => {
    render(<TeamList />);
    await waitFor(() =>
      expect(screen.getAllByRole('row'))
        // Number of teams plus table header row
        .toHaveLength(MOCK_TEAMS.length + 1)
    );
  });

  it('clicks the delete button and opens the TeamDeleteModal', async () => {
    const mockTeam = MOCK_TEAMS[0];
    jest.spyOn(appEvents, 'publish');
    render(<TeamList />);
    await userEvent.click(await screen.findByRole('button', { name: `Delete ${mockTeam.spec.title}` }));

    expect(appEvents.publish).toHaveBeenCalledWith(
      new ShowModalReactEvent(
        expect.objectContaining({
          component: TeamDeleteModal,
        })
      )
    );
  });

  describe('when user has access to create a team', () => {
    it('should enable the new team button', async () => {
      render(<TeamList />);

      expect(await screen.findByRole('link', { name: /new team/i })).not.toHaveStyle('pointer-events: none');
    });
  });

  describe('when user does not have access to create a team', () => {
    it('should disable the new team button', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
      render(<TeamList />);

      expect(await screen.findByRole('link', { name: /new team/i })).toHaveStyle('pointer-events: none');
    });
  });

  describe('when searching teams', () => {
    it('sends the raw query to the backend without regex-escaping special characters', async () => {
      let capturedQuery: string | null = null;
      server.use(
        http.get('/api/teams/search', ({ request }) => {
          capturedQuery = new URL(request.url).searchParams.get('query');
          const teams = MOCK_TEAMS.map((team) => ({
            name: team.spec.title,
            uid: team.metadata.name,
            id: Number(team.metadata.labels['grafana.app/deprecatedInternalID']),
            orgId: 1,
            memberCount: 0,
            permission: 0,
            accessControl: null,
          }));
          return HttpResponse.json({ totalCount: teams.length, teams, page: 1, perPage: 20 });
        })
      );

      const { user } = render(<TeamList />);
      const input = await screen.findByPlaceholderText('Search teams');
      // Regex-special characters like the hyphen must reach the backend unescaped (not "k8s\-test").
      await user.click(input);
      await user.paste('k8s-test alpha');

      await waitFor(() => expect(capturedQuery).toBe('k8s-test alpha'));
    });

    it('finds a team whose name contains a hyphen', async () => {
      // Mimic the backend substring match. With regex-escaping the query becomes
      // "k8s\-test", which matches nothing; only the raw query "k8s-test" matches.
      const searchableTeams = [
        { name: 'k8s-test', uid: 'team-1', id: 1, orgId: 1, memberCount: 0, permission: 0, accessControl: null },
        { name: 'production', uid: 'team-2', id: 2, orgId: 1, memberCount: 0, permission: 0, accessControl: null },
      ];
      server.use(
        http.get('/api/teams/search', ({ request }) => {
          const query = (new URL(request.url).searchParams.get('query') ?? '').toLowerCase();
          const matches = searchableTeams.filter((team) => team.name.toLowerCase().includes(query));
          return HttpResponse.json({ totalCount: matches.length, teams: matches, page: 1, perPage: 20 });
        })
      );

      const { user } = render(<TeamList />);
      const input = await screen.findByPlaceholderText('Search teams');
      await user.click(input);
      await user.paste('k8s-test');

      // The initial (empty query) response lists all teams, so wait until the
      // non-matching team is filtered out before asserting on the results.
      await waitFor(() => expect(screen.queryByText('production')).not.toBeInTheDocument(), { timeout: 5000 });
      expect(screen.getByText('k8s-test')).toBeInTheDocument();
    });
  });

  it('should close the delete modal after confirming team deletion', async () => {
    const mockTeam = MOCK_TEAMS[0];
    render(
      <>
        <TeamList />
        <ModalRoot />
      </>
    );

    // Click the delete button to open the modal
    await userEvent.click(await screen.findByRole('button', { name: `Delete ${mockTeam.spec.title}` }));

    // The modal should be visible with a Delete heading
    const modalTitle = await screen.findByRole('heading', { name: /delete/i });
    expect(modalTitle).toBeInTheDocument();

    // Click the confirm delete button in the modal (the one inside the dialog, not the icon buttons)
    const modal = screen.getByRole('dialog');
    const confirmButton = within(modal).getByRole('button', { name: /delete/i });
    await userEvent.click(confirmButton);

    // The modal should close after deletion
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /delete/i })).not.toBeInTheDocument();
    });
  });
});
