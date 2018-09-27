import React from 'react';
import { shallow } from 'enzyme';
import { PluginActionBar, Props } from './PluginActionBar';
import { LayoutModes } from '../../core/components/LayoutSelector/LayoutSelector';

const setup = (propOverrides?: object) => {
  const props: Props = {
    searchQuery: '',
    layoutMode: LayoutModes.Grid,
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
