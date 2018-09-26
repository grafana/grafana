import React from 'react';
import { shallow } from 'enzyme';
import PluginList from './PluginList';
import { getMockPlugins } from './__mocks__/pluginMocks';

const setup = (propOverrides?: object) => {
  const props = Object.assign(
    {
      plugins: getMockPlugins(5),
      layout: 'grid',
    },
    propOverrides
  );

  return shallow(<PluginList {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });
});
