import { render, screen, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { MOCK_TEAMS, MOCK_TEAM_GROUPS } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';

import TeamGroupSync from './TeamGroupSync';

setBackendSrv(backendSrv);
setupMockServer();

const setup = () => {
  return render(<TeamGroupSync teamUid={MOCK_TEAMS[0].metadata.name} isReadOnly={false} />);
};

describe('TeamGroupSync', () => {
  it('should render component', () => {
    setup();
    expect(screen.getByRole('heading', { name: /External group sync/i })).toBeInTheDocument();
  });

  it('should render groups table', async () => {
    setup();
    expect(await screen.findAllByRole('row')).toHaveLength(MOCK_TEAM_GROUPS.length + 1); // items plus table header
  });

  it('should call add group', async () => {
    const { user } = setup();
    // Wait for the groups to load so the "Add group" button appears
    await screen.findAllByRole('row');

    await user.click(screen.getAllByRole('button', { name: /add group/i })[0]);
    expect(screen.getByRole('textbox', { name: /add external group/i })).toBeVisible();

    await user.type(screen.getByRole('textbox', { name: /add external group/i }), 'test/group');
    await user.click(screen.getAllByRole('button', { name: /add group/i })[1]);

    expect(await screen.findByRole('row', { name: /test\/group/i })).toBeInTheDocument();
  });

  it('should remove group', async () => {
    const { user } = setup();
    const groupToRemove = MOCK_TEAM_GROUPS[0].groupId;

    // Wait for group to be rendered
    await screen.findByRole('row', { name: new RegExp(groupToRemove, 'i') });

    // Remove group
    await user.click(screen.getByRole('button', { name: `Remove group ${groupToRemove}` }));

    await waitFor(() =>
      expect(screen.queryByRole('row', { name: new RegExp(groupToRemove, 'i') })).not.toBeInTheDocument()
    );
  });
});
