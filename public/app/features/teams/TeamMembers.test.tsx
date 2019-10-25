import React from 'react';
import { shallow } from 'enzyme';
import { TeamMembers, Props, State } from './TeamMembers';
import { TeamMember, OrgRole } from '../../types';
import { getMockTeamMembers } from './__mocks__/teamMocks';
import { User } from 'app/core/services/context_srv';

const signedInUserId = 1;

const setup = (propOverrides?: object) => {
  const props: Props = {
    members: [] as TeamMember[],
    searchMemberQuery: '',
    setSearchMemberQuery: jest.fn(),
    addTeamMember: jest.fn(),
    syncEnabled: false,
    editorsCanAdmin: false,
    signedInUser: {
      id: signedInUserId,
      isGrafanaAdmin: false,
      orgRole: OrgRole.Viewer,
    } as User,
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
    const { wrapper } = setup({});

    expect(wrapper).toMatchSnapshot();
  });

  it('should render team members', () => {
    const { wrapper } = setup({ members: getMockTeamMembers(5, 5) });

    expect(wrapper).toMatchSnapshot();
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

  describe('on add user to team', () => {
    const { wrapper, instance } = setup({});
    const state = wrapper.state() as State;

    state.newTeamMember = {
      id: 1,
      label: '',
      avatarUrl: '',
      login: '',
      name: '',
      email: '',
    };

    instance.onAddUserToTeam();

    expect(instance.props.addTeamMember).toHaveBeenCalledWith(1);
  });
});
