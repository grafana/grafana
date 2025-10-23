import { render, screen, waitFor, userEvent } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { Team, TeamGroup } from 'app/types/teams';

import TeamGroupSync, { Props } from './TeamGroupSync';
import { getMockTeamGroups } from './mocks/teamMocks';

setBackendSrv(backendSrv);
setupMockServer();

type PreloadedTeamState = NonNullable<Parameters<typeof render>[1]>['preloadedState']['team'];
const setup = (preloadedTeamState?: PreloadedTeamState) => {
  return render(<TeamGroupSync isReadOnly={false} />, {
    preloadedState: { team: { members: [], groups: [], team: { uid: '1' } as Team } },
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
    const mockAddGroup = jest.fn();
    setup({ addTeamGroup: mockAddGroup });
    // Empty List CTA "Add group" button is second in the DOM order
    await userEvent.click(screen.getAllByRole('button', { name: /add group/i })[1]);
    expect(screen.getByRole('textbox', { name: /add external group/i })).toBeVisible();

    await userEvent.type(screen.getByRole('textbox', { name: /add external group/i }), 'test/group');
    await userEvent.click(screen.getAllByRole('button', { name: /add group/i })[0]);
    await waitFor(() => {
      expect(mockAddGroup).toHaveBeenCalledWith('test/group');
    });
  });

  xit('should call remove group', async () => {
    const mockRemoveGroup = jest.fn();
    const mockGroup: TeamGroup = { teamId: 1, groupId: 'someGroup' };
    setup({ removeTeamGroup: mockRemoveGroup, groups: [mockGroup] });
    await userEvent.click(screen.getByRole('button', { name: 'Remove group someGroup' }));
    await waitFor(() => {
      expect(mockRemoveGroup).toHaveBeenCalledWith('someGroup');
    });
  });
});
