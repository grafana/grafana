import React from 'react';
import { shallow } from 'enzyme';
import { DataSourceSettingsPage, Props } from './DataSourceSettingsPage';
import { NavModel } from 'app/types';
import { DataSourceSettings } from '@grafana/ui';
import { getMockDataSource } from '../__mocks__/dataSourcesMocks';
import { getMockPlugin } from '../../plugins/__mocks__/pluginMocks';
import { setDataSourceName, setIsDefault } from '../state/actions';

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
  };

  Object.assign(props, propOverrides);

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
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should render is ready only message', () => {
    const wrapper = setup({
      dataSource: { ...getMockDataSource(), readOnly: true },
    });

    expect(wrapper).toMatchSnapshot();
  });
});
