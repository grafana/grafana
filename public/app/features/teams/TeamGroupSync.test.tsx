import { render, screen } from 'test/test-utils';

import {
  useAddTeamGroupApiMutation,
  useGetTeamGroupsApiQuery,
  useRemoveTeamGroupApiQueryMutation,
} from '@grafana/api-clients/rtkq/legacy';
import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';
import { TeamGroup } from 'app/types/teams';

import TeamGroupSync from './TeamGroupSync';
import { getMockTeamGroups } from './mocks/teamMocks';

setBackendSrv(backendSrv);
setupMockServer();

// Mock the hooks
jest.mock('@grafana/api-clients/rtkq/legacy', () => ({
  ...jest.requireActual('@grafana/api-clients/rtkq/legacy'),
  useGetTeamGroupsApiQuery: jest.fn(),
  useAddTeamGroupApiMutation: jest.fn(),
  useRemoveTeamGroupApiQueryMutation: jest.fn(),
}));

const mockUseGetTeamGroups = useGetTeamGroupsApiQuery as jest.Mock;
const mockUseAddTeamGroup = useAddTeamGroupApiMutation as jest.Mock;
const mockUseRemoveTeamGroup = useRemoveTeamGroupApiQueryMutation as jest.Mock;

const setup = (groups: TeamGroup[] = []) => {
  const refetch = jest.fn();
  mockUseGetTeamGroups.mockReturnValue({ data: groups, refetch });
  const addTeamGroup = jest.fn();
  mockUseAddTeamGroup.mockReturnValue([addTeamGroup, {}]);
  const removeTeamGroup = jest.fn();
  mockUseRemoveTeamGroup.mockReturnValue([removeTeamGroup, {}]);

  return {
    ...render(<TeamGroupSync teamUid="team-1" isReadOnly={false} />),
    refetch,
    addTeamGroup,
    removeTeamGroup,
  };
};

describe('TeamGroupSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render component', () => {
    setup();
    expect(screen.getByRole('heading', { name: /External group sync/i })).toBeInTheDocument();
  });

  it('should render groups table', () => {
    setup(getMockTeamGroups(3));
    expect(screen.getAllByRole('row')).toHaveLength(4); // 3 items plus table header
  });

  it('should call add group', async () => {
    const { user, addTeamGroup } = setup();
    // Empty List CTA "Add group" button is second in the DOM order
    await user.click(screen.getAllByRole('button', { name: /add group/i })[1]);
    expect(screen.getByRole('textbox', { name: /add external group/i })).toBeVisible();

    await user.type(screen.getByRole('textbox', { name: /add external group/i }), 'test/group');
    await user.click(screen.getAllByRole('button', { name: /add group/i })[0]);

    expect(addTeamGroup).toHaveBeenCalledWith({ teamId: 'team-1', teamGroupMapping: { groupId: 'test/group' } });
  });

  it('should remove group', async () => {
    const mockGroup: TeamGroup = { teamId: 1, groupId: 'someGroup' };
    const { user, removeTeamGroup } = setup([mockGroup]);
    await user.click(screen.getByRole('button', { name: 'Remove group someGroup' }));

    expect(removeTeamGroup).toHaveBeenCalledWith({ teamId: 'team-1', groupId: 'someGroup' });
  });
});
