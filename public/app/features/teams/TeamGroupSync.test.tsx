import React from 'react';
import { shallow } from 'enzyme';
import { Props, TeamGroupSync } from './TeamGroupSync';
import { TeamGroup } from '../../types';
import { getMockTeamGroups } from './__mocks__/teamMocks';

const setup = (propOverrides?: object) => {
  const props: Props = {
    groups: [] as TeamGroup[],
    loadTeamGroups: jest.fn(),
    addTeamGroup: jest.fn(),
    removeTeamGroup: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<TeamGroupSync {...props} />);
  const instance = wrapper.instance() as TeamGroupSync;

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

  it('should render groups table', () => {
    const { wrapper } = setup({
      groups: getMockTeamGroups(3),
    });

    expect(wrapper).toMatchSnapshot();
  });
});

describe('Functions', () => {
  it('should call add group', () => {
    const { instance } = setup();

    instance.setState({ newGroupId: 'some/group' });
    const mockEvent = { preventDefault: jest.fn() };

    instance.onAddGroup(mockEvent);

    expect(instance.props.addTeamGroup).toHaveBeenCalledWith('some/group');
  });

  it('should call remove group', () => {
    const { instance } = setup();

    const mockGroup: TeamGroup = { teamId: 1, groupId: 'some/group' };

    instance.onRemoveGroup(mockGroup);

    expect(instance.props.removeTeamGroup).toHaveBeenCalledWith('some/group');
  });
});
