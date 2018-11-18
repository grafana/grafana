import React from 'react';
import { shallow } from 'enzyme';
import { PluginListPage, Props } from './PluginListPage';
import { NavModel, Plugin } from '../../types';
import { LayoutModes } from '../../core/components/LayoutSelector/LayoutSelector';

const setup = (propOverrides?: object) => {
  const props: Props = {
    navModel: {} as NavModel,
    plugins: [] as Plugin[],
    searchQuery: '',
    setPluginsSearchQuery: jest.fn(),
    setPluginsLayoutMode: jest.fn(),
    layoutMode: LayoutModes.Grid,
    loadPlugins: jest.fn(),
    hasFetched: false,
  };

  Object.assign(props, propOverrides);

  return shallow(<PluginListPage {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render list', () => {
    const wrapper = setup({
      hasFetched: true,
    });

    expect(wrapper).toMatchSnapshot();
  });
});
