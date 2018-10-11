import React from 'react';
import { shallow } from 'enzyme';
import { TeamMembers, Props, State } from './TeamMembers';
import { TeamMember } from '../../types';
import { getMockTeamMember, getMockTeamMembers } from './__mocks__/teamMocks';

const setup = (propOverrides?: object) => {
  const props: Props = {
    members: [] as TeamMember[],
    searchMemberQuery: '',
    setSearchMemberQuery: jest.fn(),
    loadTeamMembers: jest.fn(),
    addTeamMember: jest.fn(),
    removeTeamMember: jest.fn(),
    syncEnabled: false,
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<TeamMembers {...props} />);
  const instance = wrapper.instance() as TeamMembers;

  return {
    wrapper,
    instance,
  };
};

describe('Render', () => {
  it('should render component', () => {
    const { wrapper } = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render team members', () => {
    const { wrapper } = setup({
      members: getMockTeamMembers(5),
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should render team members when sync enabled', () => {
    const { wrapper } = setup({
      members: getMockTeamMembers(5),
      syncEnabled: true,
    });

    expect(wrapper).toMatchSnapshot();
  });
});

describe('Functions', () => {
  describe('on search member query change', () => {
    it('it should call setSearchMemberQuery', () => {
      const { instance } = setup();
      const mockEvent = { target: { value: 'member' } };

      instance.onSearchQueryChange(mockEvent);

      expect(instance.props.setSearchMemberQuery).toHaveBeenCalledWith('member');
    });
  });

  describe('on remove member', () => {
    const { instance } = setup();
    const mockTeamMember = getMockTeamMember();

    instance.onRemoveMember(mockTeamMember);

    expect(instance.props.removeTeamMember).toHaveBeenCalledWith(1);
  });

  describe('on add user to team', () => {
    const { wrapper, instance } = setup();
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
});
