import { render, screen } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { MOCK_TEAMS } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { Team, TeamGroup, TeamState } from 'app/types/teams';

import TeamGroupSync from './TeamGroupSync';
import { getMockTeamGroups } from './mocks/teamMocks';

setBackendSrv(backendSrv);
setupMockServer();

const setup = (preloadedTeamState?: Partial<TeamState>) => {
  return render(<TeamGroupSync isReadOnly={false} />, {
    preloadedState: {
      team: {
        members: [],
        groups: [],
        team: { uid: MOCK_TEAMS[0].metadata.name } as Team,
        ...preloadedTeamState,
      },
    },
  });
};

describe('TeamGroupSync', () => {
  it('should render component', () => {
    setup();
    expect(screen.getByRole('heading', { name: /External group sync/i })).toBeInTheDocument();
  });

  it('should render groups table', () => {
    setup({ groups: getMockTeamGroups(3) });
    expect(screen.getAllByRole('row')).toHaveLength(4); // 3 items plus table header
  });

  it('should call add group', async () => {
    const { user } = setup();
    // Empty List CTA "Add group" button is second in the DOM order
    await user.click(screen.getAllByRole('button', { name: /add group/i })[1]);
    expect(screen.getByRole('textbox', { name: /add external group/i })).toBeVisible();

    await user.type(screen.getByRole('textbox', { name: /add external group/i }), 'test/group');
    await user.click(screen.getAllByRole('button', { name: /add group/i })[0]);

    expect(screen.getByRole('row', { name: /test\/group/i })).toBeInTheDocument();
  });

  it('should remove group', async () => {
    const mockGroup: TeamGroup = { teamId: 1, groupId: 'someGroup' };
    const { user } = setup({ groups: [mockGroup] });
    await user.click(screen.getByRole('button', { name: 'Remove group someGroup' }));

    expect(screen.queryByRole('row', { name: /test\/group/i })).not.toBeInTheDocument();
  });
});
