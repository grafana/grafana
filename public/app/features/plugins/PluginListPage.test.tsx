import React from 'react';
import { shallow } from 'enzyme';
import { PluginListPage, Props } from './PluginListPage';
import { NavModel, Plugin } from '../../types';
import { LayoutModes } from '../../core/components/LayoutSelector/LayoutSelector';

const setup = (propOverrides?: object) => {
  const props: Props = {
    navModel: {} as NavModel,
    plugins: [] as Plugin[],
    layoutMode: LayoutModes.Grid,
    loadPlugins: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<PluginListPage {...props} />);
  const instance = wrapper.instance() as PluginListPage;

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
