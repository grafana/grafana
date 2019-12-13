import React from 'react';
import { shallow } from 'enzyme';
import { PluginListPage, Props } from './PluginListPage';
import { LayoutModes } from '../../core/components/LayoutSelector/LayoutSelector';
import { NavModel } from '@grafana/data';
import { PluginMeta } from '@grafana/data';

const setup = (propOverrides?: object) => {
  const props: Props = {
    navModel: {
      main: {
        text: 'Configuration',
      },
      node: {
        text: 'Plugins',
      },
    } as NavModel,
    plugins: [] as PluginMeta[],
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
