import React from 'react';
import { shallow } from 'enzyme';
import { Props, TeamSettings } from './TeamSettings';
import { getMockTeam } from './__mocks__/teamMocks';

jest.mock('app/core/core', () => ({
  contextSrv: {
    hasPermissionInMetadata: () => true,
  },
}));

const setup = (propOverrides?: object) => {
  const props: Props = {
    team: getMockTeam(),
    updateTeam: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<TeamSettings {...props} />);
  const instance = wrapper.instance() as any;

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
});
