import React from 'react';
import { shallow } from 'enzyme';
import { Props, TeamSettings } from './TeamSettings';
import { getMockTeam } from './__mocks__/teamMocks';

const setup = (propOverrides?: object) => {
  const props: Props = {
    team: getMockTeam(),
    updateTeam: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<TeamSettings {...props} />);
  const instance = wrapper.instance() as TeamSettings;

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

describe('Functions', () => {
  it('should update team', () => {
    const { instance } = setup();
    const mockEvent = { preventDefault: jest.fn() };

    instance.setState({
      name: 'test11',
    });

    instance.onUpdate(mockEvent);

    expect(instance.props.updateTeam).toHaveBeenCalledWith('test11', 'test@test.com');
  });
});
