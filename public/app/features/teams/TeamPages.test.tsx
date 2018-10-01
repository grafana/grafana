import React from 'react';
import { shallow } from 'enzyme';
import { TeamPages, Props } from './TeamPages';
import { NavModel, Team } from '../../types';
import { getMockTeam } from './__mocks__/teamMocks';

jest.mock('app/core/config', () => ({
  buildInfo: { isEnterprise: true },
}));

const setup = (propOverrides?: object) => {
  const props: Props = {
    navModel: {} as NavModel,
    teamId: 1,
    loadTeam: jest.fn(),
    pageName: 'members',
    team: {} as Team,
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<TeamPages {...props} />);
  const instance = wrapper.instance();

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

  it('should render member page if team not empty', () => {
    const { wrapper } = setup({
      team: getMockTeam(),
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should render settings page', () => {
    const { wrapper } = setup({
      team: getMockTeam(),
      pageName: 'settings',
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should render group sync page', () => {
    const { wrapper } = setup({
      team: getMockTeam(),
      pageName: 'groupsync',
    });

    expect(wrapper).toMatchSnapshot();
  });
});
