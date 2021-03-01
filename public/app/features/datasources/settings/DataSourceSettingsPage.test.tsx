import React from 'react';
import { shallow } from 'enzyme';
import { DataSourceSettingsPage, Props } from './DataSourceSettingsPage';
import { DataSourceConstructor, DataSourcePlugin, DataSourceSettings, NavModel } from '@grafana/data';
import { getMockDataSource } from '../__mocks__/dataSourcesMocks';
import { getMockPlugin } from '../../plugins/__mocks__/pluginMocks';
import { dataSourceLoaded, setDataSourceName, setIsDefault } from '../state/reducers';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { cleanUpAction } from 'app/core/actions/cleanUp';

const pluginMock = new DataSourcePlugin({} as DataSourceConstructor<any>);

jest.mock('app/features/plugins/plugin_loader', () => {
  return {
    importDataSourcePlugin: () => Promise.resolve(pluginMock),
  };
});

const setup = (propOverrides?: object) => {
  const props: Props = {
    ...getRouteComponentProps(),
    navModel: {} as NavModel,
    dataSource: getMockDataSource(),
    dataSourceMeta: getMockPlugin(),
    dataSourceId: 1,
    deleteDataSource: jest.fn(),
    loadDataSource: jest.fn(),
    setDataSourceName,
    updateDataSource: jest.fn(),
    initDataSourceSettings: jest.fn(),
    testDataSource: jest.fn(),
    setIsDefault,
    dataSourceLoaded,
    cleanUpAction,
    page: null,
    plugin: null,
    loadError: null,
    testingStatus: {},
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
