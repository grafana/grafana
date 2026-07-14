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
setupMockServer();

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
