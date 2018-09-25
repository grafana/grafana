import React from 'react';
import { shallow } from 'enzyme';
import { PluginListPage, Props } from './PluginListPage';
import { NavModel, Plugin } from '../../types';

const setup = (propOverrides?: object) => {
  const props: Props = {
    navModel: {} as NavModel,
    plugins: [] as Plugin[],
    layoutMode: 'grid',
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
