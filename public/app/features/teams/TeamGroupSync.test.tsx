import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TeamGroup } from 'app/types/teams';

import { Props, TeamGroupSync } from './TeamGroupSync';
import { getMockTeamGroups } from './mocks/teamMocks';

const setup = (propOverrides?: object) => {
  const props: Props = {
    isReadOnly: false,
    groups: [] as TeamGroup[],
    loadTeamGroups: jest.fn(),
    addTeamGroup: jest.fn(),
    removeTeamGroup: jest.fn(),
  };

  Object.assign(props, propOverrides);

  return render(<TeamGroupSync {...props} />);
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

  it('should call remove group', async () => {
    const mockRemoveGroup = jest.fn();
    const mockGroup: TeamGroup = { teamId: 1, groupId: 'someGroup' };
    setup({ removeTeamGroup: mockRemoveGroup, groups: [mockGroup] });
    await userEvent.click(screen.getByRole('button', { name: 'Remove group someGroup' }));
    await waitFor(() => {
      expect(mockRemoveGroup).toHaveBeenCalledWith('someGroup');
    });
  });
});
