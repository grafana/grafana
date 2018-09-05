import React from 'react';
import { shallow } from 'enzyme';
import { TeamList, Props } from './TeamList';
import { NavModel, Team } from '../../types';

const setup = (propOverrides?: object) => {
  const props: Props = {
    navModel: {} as NavModel,
    teams: [] as Team[],
    loadTeams: jest.fn(),
    search: '',
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
      teams: [
        {
          id: 1,
          name: 'test',
          avatarUrl: 'some/url/',
          email: 'test@test.com',
          memberCount: 1,
          search: '',
          members: [],
          groups: [],
        },
      ],
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

describe('Functions', () => {});
