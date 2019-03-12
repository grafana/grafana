import React from 'react';
import { shallow } from 'enzyme';
import { TeamMembers, Props, State } from './TeamMembers';
import { TeamMember, TeamPermissionLevel } from '../../types';
import { getMockTeamMember, getMockTeamMembers } from './__mocks__/teamMocks';
import { SelectOptionItem } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    isGrafanaAdmin: false,
    hasRole: role => false,
    user: { id: 1 },
  },
}));

const originalContextSrv = contextSrv;

interface SetupProps {
  propOverrides?: object;
  isGrafanaAdmin?: boolean;
  isOrgAdmin?: boolean;
}

const setup = (setupProps: SetupProps) => {
  const props: Props = {
    members: [] as TeamMember[],
    searchMemberQuery: '',
    setSearchMemberQuery: jest.fn(),
    loadTeamMembers: jest.fn(),
    addTeamMember: jest.fn(),
    removeTeamMember: jest.fn(),
    updateTeamMember: jest.fn(),
    syncEnabled: false,
    editorsCanAdmin: false,
  };

  contextSrv.isGrafanaAdmin = setupProps.isGrafanaAdmin || false;
  contextSrv.hasRole = role => setupProps.isOrgAdmin || false;

  Object.assign(props, setupProps.propOverrides);

  const wrapper = shallow(<TeamMembers {...props} />);
  const instance = wrapper.instance() as TeamMembers;

  return {
    wrapper,
    instance,
  };
};

describe('Render', () => {
  beforeEach(() => {
    contextSrv.isGrafanaAdmin = originalContextSrv.isGrafanaAdmin;
    contextSrv.hasRole = originalContextSrv.hasRole;
  });

  it('should render component', () => {
    const { wrapper } = setup({});

    expect(wrapper).toMatchSnapshot();
  });

  it('should render team members', () => {
    const { wrapper } = setup({
      propOverrides: {
        members: getMockTeamMembers(5),
      },
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should render team members when sync enabled', () => {
    const { wrapper } = setup({
      propOverrides: {
        members: getMockTeamMembers(5),
        syncEnabled: true,
      },
    });

    expect(wrapper).toMatchSnapshot();
  });

  describe('when feature toggle editorsCanAdmin is turned on', () => {
    it('should render permissions select if user is Grafana Admin', () => {
      const members = getMockTeamMembers(5);
      members[4].permission = TeamPermissionLevel.Admin;
      const { wrapper } = setup({
        propOverrides: { members, editorsCanAdmin: true },
        isGrafanaAdmin: true,
        isOrgAdmin: false,
      });

      expect(wrapper).toMatchSnapshot();
    });

    it('should render permissions select if user is Org Admin', () => {
      const members = getMockTeamMembers(5);
      members[4].permission = TeamPermissionLevel.Admin;
      const { wrapper } = setup({
        propOverrides: { members, editorsCanAdmin: true },
        isGrafanaAdmin: false,
        isOrgAdmin: true,
      });

      expect(wrapper).toMatchSnapshot();
    });

    it('should render permissions select if user is team admin', () => {
      const members = getMockTeamMembers(5);
      members[0].permission = TeamPermissionLevel.Admin;
      const { wrapper } = setup({
        propOverrides: { members, editorsCanAdmin: true },
        isGrafanaAdmin: false,
        isOrgAdmin: false,
      });

      expect(wrapper).toMatchSnapshot();
    });
  });
});

describe('Functions', () => {
  describe('on search member query change', () => {
    it('it should call setSearchMemberQuery', () => {
      const { instance } = setup({});

      instance.onSearchQueryChange('member');

      expect(instance.props.setSearchMemberQuery).toHaveBeenCalledWith('member');
    });
  });

  describe('on remove member', () => {
    const { instance } = setup({});
    const mockTeamMember = getMockTeamMember();

    instance.onRemoveMember(mockTeamMember);

    expect(instance.props.removeTeamMember).toHaveBeenCalledWith(1);
  });

  describe('on add user to team', () => {
    const { wrapper, instance } = setup({});
    const state = wrapper.state() as State;

    state.newTeamMember = {
      id: 1,
      label: '',
      avatarUrl: '',
      login: '',
    };

    instance.onAddUserToTeam();

    expect(instance.props.addTeamMember).toHaveBeenCalledWith(1);
  });

  describe('on update permision for user in team', () => {
    const { instance } = setup({});
    const permission = TeamPermissionLevel.Admin;
    const item: SelectOptionItem = { value: permission };
    const member: TeamMember = {
      userId: 3,
      teamId: 2,
      avatarUrl: '',
      email: 'user@user.org',
      labels: [],
      login: 'member',
      permission: TeamPermissionLevel.Member,
    };
    const expectedTeamMemeber = { ...member, permission };

    instance.onPermissionChange(item, member);

    expect(instance.props.updateTeamMember).toHaveBeenCalledWith(expectedTeamMemeber);
  });
});
