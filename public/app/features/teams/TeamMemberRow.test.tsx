import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { TeamPermissionLevel } from '../../types';

import { TeamMemberRow, Props } from './TeamMemberRow';
import { getMockTeamMember } from './__mocks__/teamMocks';

const setup = (propOverrides?: object) => {
  const props: Props = {
    member: getMockTeamMember(),
    syncEnabled: false,
    editorsCanAdmin: false,
    signedInUserIsTeamAdmin: false,
    updateTeamMember: jest.fn(),
    removeTeamMember: jest.fn(),
  };

  Object.assign(props, propOverrides);

  render(
    <table>
      <tbody>
        <TeamMemberRow {...props} />
      </tbody>
    </table>
  );
};

describe('Render', () => {
  it('should render team member labels when sync enabled', () => {
    const member = getMockTeamMember();
    member.labels = ['LDAP'];
    setup({ member, syncEnabled: true });
    expect(screen.getByText('LDAP')).toBeInTheDocument();
  });

  describe('when feature toggle editorsCanAdmin is turned on', () => {
    it('should render permissions select if user is team admin', () => {
      const member = getMockTeamMember();
      setup({ editorsCanAdmin: true, signedInUserIsTeamAdmin: true, member });
      expect(screen.getByLabelText(`Select member's ${member.name} permission level`)).toBeInTheDocument();
    });
  });

  describe('when feature toggle editorsCanAdmin is turned off', () => {
    it('should not render permissions', () => {
      const member = getMockTeamMember();
      setup({ editorsCanAdmin: false, signedInUserIsTeamAdmin: true, member });
      expect(screen.queryByLabelText(`Select member's ${member.name} permission level`)).not.toBeInTheDocument();
    });
  });
});

describe('Functions', () => {
  it('should remove member on remove button click', async () => {
    const member = getMockTeamMember();
    const mockRemove = jest.fn();
    setup({ member, removeTeamMember: mockRemove, editorsCanAdmin: true, signedInUserIsTeamAdmin: true });
    await userEvent.click(screen.getByRole('button', { name: `Remove team member ${member.name}` }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(mockRemove).toHaveBeenCalledWith(member.userId);
  });

  it('should update permission for user in team', async () => {
    const member = getMockTeamMember();
    const mockUpdate = jest.fn();
    setup({ member, editorsCanAdmin: true, signedInUserIsTeamAdmin: true, updateTeamMember: mockUpdate });
    const permission = TeamPermissionLevel.Admin;
    const expectedTeamMember = { ...member, permission };
    await userEvent.click(screen.getByLabelText(`Select member's ${member.name} permission level`));
    await userEvent.click(screen.getByText('Admin'));

    expect(mockUpdate).toHaveBeenCalledWith(expectedTeamMember);
  });
});
