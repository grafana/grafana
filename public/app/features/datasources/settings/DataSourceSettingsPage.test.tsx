import React from 'react';
import { shallow } from 'enzyme';
import { DataSourceSettingsPage, Props } from './DataSourceSettingsPage';
import { DataSourceSettings, DataSourcePlugin, DataSourceConstructor, NavModel } from '@grafana/data';
import { getMockDataSource } from '../__mocks__/dataSourcesMocks';
import { getMockPlugin } from '../../plugins/__mocks__/pluginMocks';
import { setDataSourceName, setIsDefault, dataSourceLoaded } from '../state/actions';

const pluginMock = new DataSourcePlugin({} as DataSourceConstructor<any>);

jest.mock('app/features/plugins/plugin_loader', () => {
  return {
    importDataSourcePlugin: () => Promise.resolve(pluginMock),
  };
});

const setup = (propOverrides?: object) => {
  const props: Props = {
    navModel: {} as NavModel,
    dataSource: getMockDataSource(),
    dataSourceMeta: getMockPlugin(),
    pageId: 1,
    deleteDataSource: jest.fn(),
    loadDataSource: jest.fn(),
    setDataSourceName,
    updateDataSource: jest.fn(),
    setIsDefault,
    dataSourceLoaded,
    query: {},
    ...propOverrides,
  };

  return shallow(<DataSourceSettingsPage {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render loader', () => {
    const wrapper = setup({
      dataSource: {} as DataSourceSettings,
      plugin: pluginMock,
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should render beta info text', () => {
    const wrapper = setup({
      dataSourceMeta: { ...getMockPlugin(), state: 'beta' },
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should render alpha info text', () => {
    const wrapper = setup({
      dataSourceMeta: { ...getMockPlugin(), state: 'alpha' },
      plugin: pluginMock,
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should render is ready only message', () => {
    const wrapper = setup({
      dataSource: { ...getMockDataSource(), readOnly: true },
      plugin: pluginMock,
    });

    expect(wrapper).toMatchSnapshot();
  });
});
