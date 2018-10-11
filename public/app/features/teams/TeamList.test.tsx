import React from 'react';
import { shallow } from 'enzyme';
import { Props, TeamList } from './TeamList';
import { NavModel, Team } from '../../types';
import { getMockTeam, getMultipleMockTeams } from './__mocks__/teamMocks';

const setup = (propOverrides?: object) => {
  const props: Props = {
    navModel: {} as NavModel,
    teams: [] as Team[],
    loadTeams: jest.fn(),
    deleteTeam: jest.fn(),
    setSearchQuery: jest.fn(),
    searchQuery: '',
    teamsCount: 0,
    hasFetched: false,
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<TeamList {...props} />);
  const instance = wrapper.instance() as TeamList;

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

  it('should render teams table', () => {
    const { wrapper } = setup({
      teams: getMultipleMockTeams(5),
      teamsCount: 5,
      hasFetched: true,
    });

    expect(wrapper).toMatchSnapshot();
  });
});

describe('Life cycle', () => {
  it('should call loadTeams', () => {
    const { instance } = setup();

    instance.componentDidMount();

    expect(instance.props.loadTeams).toHaveBeenCalled();
  });
});

describe('Functions', () => {
  describe('Delete team', () => {
    it('should call delete team', () => {
      const { instance } = setup();
      instance.deleteTeam(getMockTeam());

      expect(instance.props.deleteTeam).toHaveBeenCalledWith(1);
    });
  });

  describe('on search query change', () => {
    it('should call setSearchQuery', () => {
      const { instance } = setup();
      const mockEvent = { target: { value: 'test' } };

      instance.onSearchQueryChange(mockEvent);

      expect(instance.props.setSearchQuery).toHaveBeenCalledWith('test');
    });
  });
});
