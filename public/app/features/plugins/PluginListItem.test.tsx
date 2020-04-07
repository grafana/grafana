import React from 'react';
import { shallow } from 'enzyme';
import PluginListItem from './PluginListItem';
import { getMockPlugin } from './__mocks__/pluginMocks';

const setup = (propOverrides?: object) => {
  const props = Object.assign(
    {
      plugin: getMockPlugin(),
    },
    propOverrides
  );

  return shallow(<PluginListItem {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render has plugin section', () => {
    const mockPlugin = getMockPlugin();
    mockPlugin.hasUpdate = true;
    const wrapper = setup({
      plugin: mockPlugin,
    });

    expect(wrapper).toMatchSnapshot();
  });
});
