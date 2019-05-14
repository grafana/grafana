import React from 'react';
import { shallow } from 'enzyme';
import { TeamMember, TeamPermissionLevel } from '../../types';
import { getMockTeamMember } from './__mocks__/teamMocks';
import { TeamMemberRow, Props } from './TeamMemberRow';
import { SelectOptionItem } from '@grafana/ui';

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

  const wrapper = shallow(<TeamMemberRow {...props} />);
  const instance = wrapper.instance() as TeamMemberRow;

  return {
    wrapper,
    instance,
  };
};

describe('Render', () => {
  it('should render team members when sync enabled', () => {
    const member = getMockTeamMember();
    member.labels = ['LDAP'];
    const { wrapper } = setup({ member, syncEnabled: true });

    expect(wrapper).toMatchSnapshot();
  });

  describe('when feature toggle editorsCanAdmin is turned on', () => {
    it('should render permissions select if user is team admin', () => {
      const { wrapper } = setup({ editorsCanAdmin: true, signedInUserIsTeamAdmin: true });

      expect(wrapper).toMatchSnapshot();
    });

    it('should render span and disable buttons if user is team member', () => {
      const { wrapper } = setup({ editorsCanAdmin: true, signedInUserIsTeamAdmin: false });

      expect(wrapper).toMatchSnapshot();
    });
  });

  describe('when feature toggle editorsCanAdmin is turned off', () => {
    it('should not render permissions', () => {
      const { wrapper } = setup({ editorsCanAdmin: false, signedInUserIsTeamAdmin: true });

      expect(wrapper).toMatchSnapshot();
    });
  });
});

describe('Functions', () => {
  describe('on remove member', () => {
    const member = getMockTeamMember();
    const { instance } = setup({ member });

    instance.onRemoveMember(member);

    expect(instance.props.removeTeamMember).toHaveBeenCalledWith(1);
  });

  describe('on update permision for user in team', () => {
    const member: TeamMember = {
      userId: 3,
      teamId: 2,
      avatarUrl: '',
      email: 'user@user.org',
      labels: [],
      login: 'member',
      permission: TeamPermissionLevel.Member,
    };
    const { instance } = setup({ member });
    const permission = TeamPermissionLevel.Admin;
    const item: SelectOptionItem<TeamPermissionLevel> = { value: permission };
    const expectedTeamMemeber = { ...member, permission };

    instance.onPermissionChange(item, member);

    expect(instance.props.updateTeamMember).toHaveBeenCalledWith(expectedTeamMemeber);
  });
});
