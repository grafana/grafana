import React from 'react';
import { shallow } from 'enzyme';
import { PluginActionBar, Props } from './PluginActionBar';

const setup = (propOverrides?: object) => {
  const props: Props = {
    searchQuery: '',
    layoutMode: 'grid',
    setLayoutMode: jest.fn(),
    setPluginsSearchQuery: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<PluginActionBar {...props} />);
  const instance = wrapper.instance() as PluginActionBar;

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
