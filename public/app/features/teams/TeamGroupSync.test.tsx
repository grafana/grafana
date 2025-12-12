import { render, screen } from 'test/test-utils';

import { TeamGroup } from 'app/types/teams';

import TeamGroupSync from './TeamGroupSync';
import * as hooks from './hooks';
import { getMockTeamGroups } from './mocks/teamMocks';

// Mock the hooks
jest.mock('./hooks', () => ({
  useGetTeamGroups: jest.fn(),
  useAddTeamGroup: jest.fn(),
  useRemoveTeamGroup: jest.fn(),
}));

const mockUseGetTeamGroups = hooks.useGetTeamGroups as jest.Mock;
const mockUseAddTeamGroup = hooks.useAddTeamGroup as jest.Mock;
const mockUseRemoveTeamGroup = hooks.useRemoveTeamGroup as jest.Mock;

const setup = (groups: TeamGroup[] = []) => {
  const retry = jest.fn();
  mockUseGetTeamGroups.mockReturnValue({ value: groups, retry });
  const addTeamGroup = jest.fn();
  mockUseAddTeamGroup.mockReturnValue([addTeamGroup, {}]);
  const removeTeamGroup = jest.fn();
  mockUseRemoveTeamGroup.mockReturnValue([removeTeamGroup, {}]);

  return {
    ...render(<TeamGroupSync teamUid="team-1" isReadOnly={false} />),
    retry,
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
    const { user, addTeamGroup, retry } = setup();
    // Empty List CTA "Add group" button is second in the DOM order
    await user.click(screen.getAllByRole('button', { name: /add group/i })[1]);
    expect(screen.getByRole('textbox', { name: /add external group/i })).toBeVisible();

    await user.type(screen.getByRole('textbox', { name: /add external group/i }), 'test/group');
    await user.click(screen.getAllByRole('button', { name: /add group/i })[0]);

    expect(addTeamGroup).toHaveBeenCalledWith('team-1', 'test/group');
    expect(retry).toHaveBeenCalled();
  });

  it('should remove group', async () => {
    const mockGroup: TeamGroup = { teamId: 1, groupId: 'someGroup' };
    const { user, removeTeamGroup, retry } = setup([mockGroup]);
    await user.click(screen.getByRole('button', { name: 'Remove group someGroup' }));

    expect(removeTeamGroup).toHaveBeenCalledWith('team-1', 'someGroup');
    expect(retry).toHaveBeenCalled();
  });
});
